import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026'
const NOTION_TOKEN = process.env.NOTION_TOKEN
const NOTION_DB = 'd54e5911e8af43dfaed8f2893e59f6ef'
const EVOLUTION_URL = 'https://lanlunar-evolution.cloudfy.live/message/sendText/ZazzClaude'
const EVOLUTION_KEY = 'KGWUTIl4uXDVxFiJMhFgT1LzP8bHRcze'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS notion_tarefas_snapshot (
      page_id VARCHAR(255) PRIMARY KEY,
      titulo TEXT,
      status VARCHAR(100),
      responsavel TEXT,
      entrega DATE,
      tipo TEXT,
      snapshot_em TIMESTAMP DEFAULT NOW()
    )
  `)
}

// Normaliza qualquer string de data (ISO datetime ou date-only) para YYYY-MM-DD
function toDateOnly(d) {
  if (!d) return null
  return String(d).split('T')[0]
}

function parseTask(p) {
  const props = p.properties || {}
  const titulo = props['Descrição']?.title?.map(t => t.plain_text).join('') || '(sem título)'
  const status = props['status']?.select?.name || ''
  const responsavel = (props['Responsável']?.people || []).map(pe => pe.name).join(', ') || ''
  const entrega = toDateOnly(props['Entrega']?.date?.start) // sempre YYYY-MM-DD
  const tipo = (props['Tipo']?.multi_select || []).map(t => t.name).join(', ') || ''
  return { page_id: p.id, titulo, status, responsavel, entrega, tipo }
}

function fmtDate(d) {
  if (!d) return '—'
  const date = toDateOnly(d) // garante que não tem horário
  const [y, m, day] = date.split('-')
  return `${day}/${m}/${y}`
}

// POST /api/notion/sync-snapshot
// Compara tarefas atuais do Notion com snapshot salvo.
// Detecta mudanças em: responsavel, entrega, status.
// Envia notificação WhatsApp para grupos alertas_notion_entrega=true.
export async function POST(req) {
  const tok = req.headers.get('x-token')
  if (tok !== TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  await ensureTable()

  // 1. Busca tarefas ativas do Notion (status != Ok e não arquivadas)
  const notionRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filter: { property: 'status', select: { does_not_equal: 'Ok' } },
      page_size: 200,
    }),
  })

  if (!notionRes.ok) {
    const err = await notionRes.text()
    return NextResponse.json({ error: `Notion: ${err.slice(0, 200)}` }, { status: 502 })
  }

  const notionData = await notionRes.json()
  const tarefas = (notionData.results || []).map(parseTask)

  // 2. Carrega snapshot atual do banco
  const snap = await query('SELECT * FROM notion_tarefas_snapshot')
  const snapMap = {}
  for (const row of snap.rows) snapMap[row.page_id] = row

  // 3. Busca grupos que recebem alertas de entrega
  const gruposRes = await query(
    `SELECT chat_id, nome FROM grupos_whatsapp WHERE ativo=true AND alertas_notion_entrega=true`
  )
  const grupos = gruposRes.rows

  const alteracoes = []

  for (const t of tarefas) {
    const old = snapMap[t.page_id]

    if (!old) {
      // Nova tarefa — só salva no snapshot, notificação é responsabilidade do workflow existente
      await query(
        `INSERT INTO notion_tarefas_snapshot(page_id,titulo,status,responsavel,entrega,tipo)
         VALUES($1,$2,$3,$4,$5,$6)
         ON CONFLICT(page_id) DO NOTHING`,
        [t.page_id, t.titulo, t.status, t.responsavel, t.entrega, t.tipo]
      )
      continue
    }

    const diffs = []
    const oldEntrega = toDateOnly(old.entrega)
    const newEntrega = toDateOnly(t.entrega)

    if ((old.responsavel || '') !== (t.responsavel || ''))
      diffs.push(`Responsável: *${old.responsavel || '—'}* → *${t.responsavel || '—'}*`)
    if (oldEntrega !== newEntrega)
      diffs.push(`Entrega: *${fmtDate(oldEntrega)}* → *${fmtDate(newEntrega)}*`)
    if ((old.status || '') !== (t.status || ''))
      diffs.push(`Status: *${old.status || '—'}* → *${t.status || '—'}*`)

    if (diffs.length === 0) continue

    alteracoes.push({ titulo: t.titulo, diffs })

    // Notifica grupos
    const msg = `✏️ Tarefa editada no Notion:\n*${t.titulo}*\n${diffs.join('\n')}`
    for (const g of grupos) {
      try {
        await fetch(EVOLUTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
          body: JSON.stringify({ number: g.chat_id, text: msg }),
        })
      } catch (_) {}
    }

    // Atualiza snapshot
    await query(
      `UPDATE notion_tarefas_snapshot SET titulo=$2,status=$3,responsavel=$4,entrega=$5,tipo=$6,snapshot_em=NOW()
       WHERE page_id=$1`,
      [t.page_id, t.titulo, t.status, t.responsavel, t.entrega, t.tipo]
    )
  }

  return NextResponse.json({ ok: true, verificadas: tarefas.length, alteracoes })
}
