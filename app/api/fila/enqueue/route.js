import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'crypto';

// Enfileira jobs na fila_jobs. Chamado pelas tools do agent loop.
// Body: { tipo: 'carne'|'tarefa_notion', itens: [...], chat_id, label }
//   carne:         itens = [{ cliente, meses }]
//   tarefa_notion: itens = [{ descricao, cliente, tipo, status, data, valor, responsavel, ... }]
const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026';
const DASH_BASE = process.env.DASH_BASE || 'http://localhost:3001';
const MESES_PROIBIDOS = ['dezembro']; // gera boleto 2027 — proibido

// Normaliza nome p/ comparação: sem acento, minúsculo, só alfanumérico + espaço único.
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
// Conectores/sufixos de baixo sinal — ignorados na comparação (inflam falso-positivo).
const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'ii', 'i', 'iii', 'iv', 'jr', 'junior', 'filho', 'neto', 'sobrinho']);
function tokens(s) { return norm(s).split(' ').filter(t => t && !STOP.has(t)); }
// Levenshtein limitado (tolera 1 typo/letra trocada): "caparelli" ~ "capareli".
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 9;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
// Um token "casa" o conjunto se for igual, prefixo (≥4 chars) ou diferir por ≤1 letra (typo).
function tokenCasa(t, set) {
  for (const u of set) {
    if (t === u) return true;
    if (t.length >= 4 && u.length >= 4 && (u.startsWith(t) || t.startsWith(u))) return true;
    if (t.length >= 4 && u.length >= 4 && lev(t, u) <= 1) return true;
  }
  return false;
}
// Nomes "batem" se: (1) o PRIMEIRO nome casa (pega pessoa errada: Silvana≠Vera) E
// (2) ≥60% dos tokens significativos do nome alegado aparecem no canônico (tolera typo de
// sobrenome / nome parcial). Casos sutis (mesmo 1º nome, sobrenome diferente) ficam por
// conta da confirmação com o usuário no fluxo do bot.
function nomesBatem(claimed, canonical) {
  const a = tokens(claimed), b = new Set(tokens(canonical));
  if (!a.length || !b.size) return false;
  if (!tokenCasa(a[0], b)) return false;
  const cov = a.filter(t => tokenCasa(t, b)).length / a.length;
  return cov >= 0.6;
}
// Resolve o nome canônico de um código via API de clientes (fonte da verdade).
async function resolverNome(codigo) {
  try {
    const dig = String(codigo).replace(/\D/g, '');
    const r = await fetch(`${DASH_BASE}/api/clientes/buscar?q=${encodeURIComponent(dig)}&limit=5`, { headers: { 'x-token': TOKEN } });
    const d = await r.json().catch(() => ({}));
    const res = d.resultados || [];
    const exato = res.find(c => String(c.cod).replace(/\D/g, '') === dig);
    return exato ? exato.nome : (res[0] ? res[0].nome : null);
  } catch { return null; }
}

export async function POST(req) {
  const tok = req.headers.get('x-token');
  if (tok !== TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  try {
    const { tipo, itens, chat_id, label } = await req.json();
    if (!tipo || !Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json({ error: 'tipo e itens[] obrigatórios' }, { status: 400 });
    }

    const batch_id = crypto.randomUUID();
    let bloqueados = [];
    let rejeitados = []; // itens barrados por código↔nome não baterem (anti-cliente-errado)
    const jobs = [];

    for (const item of itens) {
      if (tipo === 'carne') {
        // Guarda de negócio: remove Dezembro (boleto 2027)
        const meses = (item.meses || []).filter(m => {
          if (MESES_PROIBIDOS.includes(String(m).toLowerCase())) { bloqueados.push(`${item.cliente}/${m}`); return false; }
          return true;
        });
        if (meses.length === 0) continue;

        // GUARD ANTI-CLIENTE-ERRADO: o bot pode alucinar um código. Resolvemos o nome
        // canônico do código e exigimos que bata com o 'nome' que o bot afirmou. Em caso
        // de dúvida (sem nome / código inexistente / mismatch) NÃO fatura — rejeita.
        if (!item.nome) {
          rejeitados.push(`${item.cliente}: faltou o nome do cliente para validar`);
          continue;
        }
        const canonical = await resolverNome(item.cliente);
        if (!canonical) {
          rejeitados.push(`código ${item.cliente} não existe na base — confirme o código`);
          continue;
        }
        if (!nomesBatem(item.nome, canonical)) {
          rejeitados.push(`código ${item.cliente} é "${canonical}", não "${item.nome}" — confirme o cliente certo`);
          continue;
        }
        jobs.push({ cliente: item.cliente, nome: item.nome, meses }); // nome persistido p/ o resumo de lote nomear quem falhou
      } else {
        jobs.push(item);
      }
    }

    if (jobs.length === 0) {
      const partes = [];
      if (rejeitados.length) partes.push(rejeitados.join('; '));
      if (bloqueados.length) partes.push('Dezembro/2027 é proibido');
      return NextResponse.json({ sucesso: false, enfileirados: 0, bloqueados, rejeitados, mensagem: partes.length ? `Nada enfileirado — ${partes.join(' | ')}.` : 'Nada a enfileirar.' });
    }

    for (const payload of jobs) {
      await query(
        `INSERT INTO fila_jobs (tipo, payload, chat_id, batch_id, batch_total, batch_label)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tipo, JSON.stringify(payload), chat_id || null, batch_id, jobs.length, label || tipo]
      );
    }

    return NextResponse.json({
      sucesso: true,
      batch_id,
      enfileirados: jobs.length,
      bloqueados,
      rejeitados,
    });
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 });
  }
}
