import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { foraDeExpediente } from '@/lib/feriados'

const EVOLUTION_URL = 'https://lanlunar-evolution.cloudfy.live/message/sendText/ZazzClaude'
const EVOLUTION_KEY = process.env.EVO_KEY || ''
const AUTH_TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026'
const MAX_TENTATIVAS = 3
const NOTION_TOKEN = process.env.NOTION_TOKEN || ''
const NOTION_DB = process.env.NOTION_DB || 'd54e5911e8af43dfaed8f2893e59f6ef'

// ── Anti-cobrança-de-resolvido (17/06/2026) ──────────────────────────────────
// Cobranças são pré-montadas e agendadas; se o chamado for resolvido no meio do
// caminho, a cobrança disparava cega. Aqui, no disparo, re-checamos o Notion: se
// todos os clientes citados na cobrança já não têm tarefa "Parado", pulamos o envio.
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const ehCobranca = (m) => /cobran[çc]a|pend[êe]ncia|sem resposta|n[ãa]o\s+(retornou|confirmou|respondeu)/i.test(m || '')
// Extrai referências de cliente da cobrança nos 2 formatos que o bot usa:
//   "482 - Celinalva Barbosa Lima"  e  "Celinalva Barbosa Lima (482)"
function refsCliente(m) {
  const refs = []
  const txt = String(m || '')
  let x
  const re1 = /(\d{2,6})\s*[-–]\s*([A-Za-zÀ-ÿ][^:\n•()]{2,60})/g
  while ((x = re1.exec(txt)) !== null) refs.push({ cod: x[1], nome: x[2].trim() })
  const re2 = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]{2,55}?)\s*\((\d{2,6})\)/g
  while ((x = re2.exec(txt)) !== null) refs.push({ cod: x[2], nome: x[1].trim() })
  return refs
}
// True ⇒ a cobrança pode ser PULADA (NENHUM cliente citado ainda está Parado no Notion).
// Fail-safe: em qualquer dúvida/erro retorna false (envia normalmente).
async function cobrancaResolvida(mensagem) {
  try {
    if (!ehCobranca(mensagem) || !NOTION_TOKEN) return false
    const refs = refsCliente(mensagem)
    if (!refs.length) return false
    const r = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter: { property: 'status', select: { equals: 'Parado' } }, page_size: 100 }),
    })
    if (!r.ok) return false
    const data = await r.json().catch(() => ({}))
    const paradas = (data.results || []).map((p) => {
      const pr = p.properties || {}
      const desc = (pr['Descrição']?.title || []).map((t) => t.plain_text).join('')
      const cli = (pr['Cliente']?.rich_text || []).map((t) => t.plain_text).join('')
      return norm(desc + ' ' + cli)
    })
    const algumPendente = refs.some((ref) => {
      const palavras = norm(ref.nome).split(' ').filter((w) => w.length > 2)
      return paradas.some((p) => p.includes(ref.cod) || (palavras.length && palavras.every((w) => p.includes(w))))
    })
    return !algumPendente // nenhum citado pendente ⇒ pode pular
  } catch { return false }
}

// Extrai @numeros do texto pra virarem MENTIONS reais no WhatsApp.
// Evolution v2: o campo `mentioned` (array de numeros) vira contextInfo.mentionedJid,
// fazendo o "@5543..." renderizar como marcacao de verdade (e nao texto cru).
function extrairMentions(texto) {
  const nums = (String(texto || '').match(/@(\d{8,15})/g) || []).map((s) => s.slice(1))
  return [...new Set(nums)]
}

export async function POST(req) {
  const token = req.headers.get('x-token')
  if (token !== AUTH_TOKEN) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  // Adiciona coluna tentativas se ainda não existe (migração segura)
  await query(`ALTER TABLE mensagens_agendadas ADD COLUMN IF NOT EXISTS tentativas INT DEFAULT 0`)

  // Recupera mensagens travadas em 'processando' há mais de 5 min (cron anterior crashou)
  await query(`
    UPDATE mensagens_agendadas SET status='pendente'
    WHERE status='processando' AND atualizado_em < NOW() - interval '5 minutes'
  `)

  // Atomic claim: marca 'processando' atomicamente via FOR UPDATE SKIP LOCKED
  // Evita que dois crons concorrentes processem a mesma mensagem
  const claimed = await query(`
    UPDATE mensagens_agendadas SET status='processando', atualizado_em=NOW()
    WHERE id IN (
      SELECT id FROM mensagens_agendadas
      WHERE status='pendente' AND agendar_para <= NOW()
      ORDER BY agendar_para ASC
      LIMIT 50
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `)

  if (claimed.rows.length === 0) return NextResponse.json({ ok: true, enviados: 0 })

  const ids = claimed.rows.map(r => r.id)

  // Busca dados completos das msgs claims
  const pendentes = await query(`
    SELECT ma.id, ma.mensagem, ma.tentativas, ma.criado_por, g.chat_id, g.nome AS grupo
    FROM mensagens_agendadas ma
    JOIN grupos_whatsapp g ON g.id = ma.grupo_id
    WHERE ma.id = ANY($1)
    ORDER BY ma.agendar_para ASC
  `, [ids])

  const off = await foraDeExpediente() // feriado / domingo / sábado fora de 09h–12h

  const results = []
  for (const row of pendentes.rows) {
    try {
      // Lembrete de PROMESSA (detector-promessas) não é cobrança: se o texto da promessa
      // casar o regex de cobrança (ex.: "resolver a pendência do X") NÃO cancela — em dia
      // fora do expediente ele REAGENDA +24h; e nunca passa pelo check de "já resolvido".
      const ehPromessa = row.criado_por === 'detector-promessas'
      // Fora do expediente: equipe não trabalha → não envia cobrança (cancela pra não ficar pendurada).
      if (off && ehCobranca(row.mensagem)) {
        if (ehPromessa) {
          await query(
            `UPDATE mensagens_agendadas SET status='pendente', agendar_para=NOW() + interval '24 hours' WHERE id=$1`,
            [row.id]
          )
          results.push({ id: row.id, status: 'reagendado', motivo: off.motivo })
          continue
        }
        await query(
          `UPDATE mensagens_agendadas SET status='cancelado', enviado_em=NOW(), erro=$2 WHERE id=$1`,
          [row.id, 'cobrança pulada: ' + off.detalhe]
        )
        results.push({ id: row.id, status: 'cancelado', motivo: off.motivo })
        continue
      }
      // Anti-cobrança-de-resolvido: se a cobrança já não tem pendência no Notion, pula.
      if (!ehPromessa && await cobrancaResolvida(row.mensagem)) {
        await query(
          `UPDATE mensagens_agendadas SET status='cancelado', enviado_em=NOW(), erro='cobrança pulada: pendência(s) já resolvida(s) no Notion' WHERE id=$1`,
          [row.id]
        )
        results.push({ id: row.id, status: 'cancelado', motivo: 'ja_resolvido' })
        continue
      }
      const mentioned = extrairMentions(row.mensagem)
      const res = await fetch(EVOLUTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
        body: JSON.stringify({ number: row.chat_id, text: row.mensagem, ...(mentioned.length ? { mentioned } : {}) }),
      })
      if (res.ok) {
        await query(
          `UPDATE mensagens_agendadas SET status='enviado', enviado_em=NOW() WHERE id=$1`,
          [row.id]
        )
        results.push({ id: row.id, status: 'enviado', grupo: row.grupo })
      } else {
        const err = await res.text()
        const tentativas = (row.tentativas || 0) + 1
        if (tentativas >= MAX_TENTATIVAS) {
          await query(
            `UPDATE mensagens_agendadas SET status='erro', erro=$1, tentativas=$2 WHERE id=$3`,
            [err.slice(0, 500), tentativas, row.id]
          )
        } else {
          // Retry com backoff de 5min
          await query(
            `UPDATE mensagens_agendadas SET status='pendente', erro=$1, tentativas=$2,
             agendar_para=NOW() + interval '5 minutes' WHERE id=$3`,
            [err.slice(0, 500), tentativas, row.id]
          )
        }
        results.push({ id: row.id, status: tentativas >= MAX_TENTATIVAS ? 'erro' : 'retry', erro: err.slice(0, 100) })
      }
    } catch (e) {
      const tentativas = (row.tentativas || 0) + 1
      if (tentativas >= MAX_TENTATIVAS) {
        await query(
          `UPDATE mensagens_agendadas SET status='erro', erro=$1, tentativas=$2 WHERE id=$3`,
          [e.message.slice(0, 500), tentativas, row.id]
        )
      } else {
        await query(
          `UPDATE mensagens_agendadas SET status='pendente', erro=$1, tentativas=$2,
           agendar_para=NOW() + interval '5 minutes' WHERE id=$3`,
          [e.message.slice(0, 500), tentativas, row.id]
        )
      }
      results.push({ id: row.id, status: tentativas >= MAX_TENTATIVAS ? 'erro' : 'retry', erro: e.message })
    }
  }

  return NextResponse.json({ ok: true, enviados: results.filter(r => r.status === 'enviado').length, results })
}
