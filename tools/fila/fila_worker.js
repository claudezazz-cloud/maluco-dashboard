// Worker da fila de jobs (carnê + tarefas Notion). Roda como processo PM2 dedicado.
// Processa SERIAL (1 por vez) — importante: 2 faturamentos na mesma conta Routerbox = conflito.
// Poll → trava job → chama o endpoint → marca feito/erro → resumo no grupo quando o lote acaba.
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
const WORKER_CARNE = '/opt/zazz/dashboard/tools/gerar_carne/worker.js';
const CARNE_TIMEOUT = parseInt(process.env.FILA_CARNE_TIMEOUT || '2400000', 10); // 40min teto (cabe lote de 6 meses novos: TIMEOUT_CONFIRM curto + sem retry pós-Executar)

// Roda um comando como LÍDER DE GRUPO (detached) e, no timeout, mata a ÁRVORE inteira
// (node worker + Chromium). Sem isso, o Chromium vira órfão e segura a sessão do Routerbox.
function execTree(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { detached: true });
    let out = '', err = '', finished = false;
    child.stdout.on('data', d => { out += d.toString(); if (out.length > 11e6) out = out.slice(-11e6); });
    child.stderr.on('data', d => { err += d.toString(); });
    const killer = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGTERM'); } catch {}                 // mata o GRUPO (node+chrome)
      setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 5000);
      if (!finished) { finished = true; reject(new Error(`timeout ${Math.round(timeoutMs / 60000)}min — árvore do faturamento morta`)); }
    }, timeoutMs);
    child.on('close', (code) => { if (finished) return; finished = true; clearTimeout(killer); resolve({ code, stdout: out, stderr: err }); });
    child.on('error', (e) => { if (finished) return; finished = true; clearTimeout(killer); reject(e); });
  });
}

// Carrega .env do dashboard (worker é processo separado, fora do Next)
(function loadEnv() {
  for (const p of ['/opt/zazz/dashboard/.env', path.join(process.cwd(), '.env')]) {
    try {
      if (!fs.existsSync(p)) continue;
      for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
      break;
    } catch {}
  }
})();

const DASH = process.env.DASH_BASE || 'http://localhost:3001';
const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026';
const EVO_URL = process.env.EVO_URL || 'https://lanlunar-evolution.cloudfy.live';
const EVO_KEY = process.env.EVO_KEY || '';
const EVO_INSTANCE = process.env.EVO_INSTANCE || 'ZazzClaude';
const POLL_MS = parseInt(process.env.FILA_POLL_MS || '4000', 10);

const pool = new pg.Pool({ connectionString: process.env.PG_URL, max: 3 });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url, body, timeoutMs = 1200000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'x-token': TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return await r.json().catch(() => ({}));
  } finally { clearTimeout(t); }
}

async function enviarTexto(chatId, texto) {
  if (!chatId || !EVO_KEY) return;
  try {
    await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: { 'apikey': EVO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: chatId, text: texto }),
    });
  } catch (e) { console.error('[FILA] erro enviarTexto:', e.message); }
}

async function pegarJob() {
  const r = await pool.query(
    `UPDATE fila_jobs SET status='processando', atualizado_em=NOW()
     WHERE id = (SELECT id FROM fila_jobs WHERE status='pendente' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED)
     RETURNING *`
  );
  return r.rows[0] || null;
}

async function processarJob(job) {
  if (job.tipo === 'carne') {
    // Roda o worker.js DIRETO via execTree (sem HTTP — o fetch do undici estourava em ~300s
    // e dava "fetch failed"). execTree mata a ÁRVORE no timeout (worker.js + Chromium).
    const meses = (job.payload.meses || []).join(',');
    const { stdout } = await execTree('node', [WORKER_CARNE, String(job.payload.cliente), meses, String(job.chat_id || '')], CARNE_TIMEOUT);
    const lines = stdout.trim().split('\n');
    const jsonLine = lines.slice().reverse().find(l => l.trim().startsWith('{'));
    return JSON.parse(jsonLine || '{"sucesso":false,"mensagem":"sem JSON do worker"}');
  }
  if (job.tipo === 'tarefa_notion') {
    return await fetchJSON(`${DASH}/api/notion/criar-tarefa`, job.payload, 60000);
  }
  throw new Error(`tipo desconhecido: ${job.tipo}`);
}

async function checarLoteCompleto(batchId) {
  const r = await pool.query(
    `SELECT batch_total, batch_label, chat_id, tipo,
            count(*) FILTER (WHERE status IN ('feito','erro')) AS concluidos,
            count(*) FILTER (WHERE status='feito') AS ok,
            count(*) FILTER (WHERE status='erro') AS erro
     FROM fila_jobs WHERE batch_id=$1
     GROUP BY batch_total, batch_label, chat_id, tipo`,
    [batchId]
  );
  const row = r.rows[0];
  if (!row || Number(row.concluidos) < Number(row.batch_total)) return;
  const total = Number(row.batch_total);
  // Item único: não manda resumo (o bot já confirmou; no carnê o vídeo é a entrega)
  if (total <= 1) return;
  const ok = Number(row.ok), erro = Number(row.erro);
  let msg;
  if (row.tipo === 'carne') {
    msg = `🧾 Carnês processados: ${ok}/${total} OK` + (erro ? `, ${erro} com erro` : '') + '.';
    if (erro) {
      // Lista QUEM falhou (nome/código do payload) pra o usuário saber o que revisar.
      const f = await pool.query(`SELECT payload FROM fila_jobs WHERE batch_id=$1 AND status='erro'`, [batchId]);
      const nomes = f.rows.map(x => (x.payload?.nome || x.payload?.cliente || '?')).filter(Boolean).join(', ');
      if (nomes) msg += `\n⚠️ Falharam (verificar): ${nomes}.`;
    }
  } else {
    msg = `✅ Tarefas no Notion: ${ok}/${total} criadas` + (erro ? `, ${erro} com erro` : '') + '.';
  }
  await enviarTexto(row.chat_id, msg);
}

async function loop() {
  console.log('[FILA] worker iniciado. Poll a cada', POLL_MS, 'ms');
  while (true) {
    let job;
    try { job = await pegarJob(); } catch (e) { console.error('[FILA] erro pegarJob:', e.message); await sleep(POLL_MS); continue; }
    if (!job) { await sleep(POLL_MS); continue; }
    console.log(`[FILA] processando job ${job.id} (${job.tipo})`);
    try {
      const res = await processarJob(job);
      const ok = res && (res.sucesso === true || res.sucesso === undefined);
      await pool.query(
        `UPDATE fila_jobs SET status=$1, resultado=$2, atualizado_em=NOW() WHERE id=$3`,
        [ok ? 'feito' : 'erro', JSON.stringify(res).slice(0, 3000), job.id]
      );
      console.log(`[FILA] job ${job.id} -> ${ok ? 'feito' : 'erro'}`);
    } catch (e) {
      await pool.query(
        `UPDATE fila_jobs SET status='erro', resultado=$1, tentativas=tentativas+1, atualizado_em=NOW() WHERE id=$2`,
        [String(e.message).slice(0, 500), job.id]
      );
      console.error(`[FILA] job ${job.id} ERRO:`, e.message);
    }
    if (job.batch_id) { try { await checarLoteCompleto(job.batch_id); } catch (e) { console.error('[FILA] erro resumo:', e.message); } }
  }
}

loop().catch(e => { console.error('[FILA] fatal:', e); process.exit(1); });
