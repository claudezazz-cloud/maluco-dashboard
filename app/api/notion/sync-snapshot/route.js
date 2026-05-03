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

// Normaliza qualquer valor de data para YYYY-MM-DD (trata Date objects do Postgres e strings ISO do Notion)
function toDateOnly(d) {
  if (!d) return null
  if (d instanceof Date) return d.toISOString().split('T')[0]
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
  const date = toDateOnly(d)
  const [y, m, day] = date.split('-')
  return `${day}/${m}/${y}`
}

// Busca todas as páginas do Notion com paginação completa
async function fetchAllTarefas() {
  const results = []
  let hasMore = true
  let startCursor = undefined

  while (hasMore) {
    const body = {
      filter: { property: 'status', select: { does_not_equal: 'Ok' } },
      page_size: 100,
    }
    if (startCursor) body.start_cursor = startCursor

    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Notion: ${err.slice(0, 200)}`)
    }

    const data = await res.json()
    results.push(...(data.results || []))
    hasMore = data.has_more || false
    startCursor = data.next_cursor
  }

  return results
}

// POST /api/notion/sync-snapshot
// Compara tarefas ativas do Notion com snapshot salvo.
// Detecta mudanças em: responsavel, entrega, status.
// Atualiza snapshot ANTES de notificar (evita race de re-notificação).
// Remove órfãos (tarefas arquivadas/deletadas no Notion).
// Filtra notificações por tipos_filtro_entrega do grupo.
export async function POST(req) {
  const tok = req.headers.get('x-token')
  if (tok !== TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  await ensureTable()

  // 1. Busca TODAS as tarefas ativas do Notion (com paginação)
  let tarefas
  try {
    const raw = await fetchAllTarefas()
    tarefas = raw.map(parseTask)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }

  // 2. Carrega snapshot atual do banco
  const snap = await query('SELECT * FROM notion_tarefas_snapshot')
  const snapMap = {}
  for (const row of snap.rows) snapMap[row.page_id] = row

  // 3. Busca grupos com tipos_filtro_entrega
  const gruposRes = await query(
    `SELECT chat_id, nome, tipos_filtro_entrega, bom_dia
     FROM grupos_whatsapp WHERE ativo=true AND alertas_notion_entrega=true`
  )
  const grupos = gruposRes.rows
  const gruposBomDia = await query(
    `SELECT chat_id, nome FROM grupos_whatsapp WHERE ativo=true AND bom_dia=true`
  )

  // 4. Detecta mudanças e acumula notificações
  const alteracoes = []
  const notificacoesPendentes = [] // { msg, grupos[] } — enviamos SÓ APÓS atualizar snapshot

  const pageIdsVistos = new Set()

  for (const t of tarefas) {
    pageIdsVistos.add(t.page_id)
    const old = snapMap[t.page_id]

    if (!old) {
      await query(
        `INSERT INTO notion_tarefas_snapshot(page_id,titulo,status,responsavel,entrega,tipo)
         VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(page_id) DO NOTHING`,
        [t.page_id, t.titulo, t.status, t.responsavel, t.entrega, t.tipo]
      )
      continue
    }

    const oldEntrega = toDateOnly(old.entrega)
    const newEntrega = toDateOnly(t.entrega)
    const diffs = []

    if ((old.responsavel || '').trim() !== (t.responsavel || '').trim())
      diffs.push(`Responsável: *${old.responsavel || '—'}* → *${t.responsavel || '—'}*`)
    if (oldEntrega !== newEntrega)
      diffs.push(`Entrega: *${fmtDate(oldEntrega)}* → *${fmtDate(newEntrega)}*`)
    if ((old.status || '') !== (t.status || ''))
      diffs.push(`Status: *${old.status || '—'}* → *${t.status || '—'}*`)

    if (diffs.length === 0) continue

    alteracoes.push({ titulo: t.titulo, diffs })

    // Atualiza snapshot ANTES de enviar (bug 4: evita re-notificação em próxima rodada)
    await query(
      `UPDATE notion_tarefas_snapshot SET titulo=$2,status=$3,responsavel=$4,entrega=$5,tipo=$6,snapshot_em=NOW()
       WHERE page_id=$1`,
      [t.page_id, t.titulo, t.status, t.responsavel, t.entrega, t.tipo]
    )

    // Resolve grupos destinatários com filtro por tipo (bug 7)
    const tiposTarefa = t.tipo ? t.tipo.split(', ').map(s => s.trim()) : []
    const gruposDestino = grupos.filter(g => {
      const filtros = g.tipos_filtro_entrega || []
      return filtros.length === 0 || tiposTarefa.some(tt => filtros.includes(tt))
    })
    // Tarefas sem tipo ou sem grupo com filtro compatível → fallback bom_dia
    const chatIdsDestino = gruposDestino.length > 0
      ? gruposDestino.map(g => g.chat_id)
      : gruposBomDia.rows.map(g => g.chat_id)

    const msg = `✏️ Tarefa editada no Notion:\n*${t.titulo}*\n${diffs.join('\n')}`
    notificacoesPendentes.push({ msg, chatIds: chatIdsDestino })
  }

  // 5. Remove órfãos (tarefas arquivadas/deletadas no Notion) — bug 3
  if (pageIdsVistos.size > 0) {
    const ids = [...pageIdsVistos]
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',')
    await query(`DELETE FROM notion_tarefas_snapshot WHERE page_id NOT IN (${placeholders})`, ids)
  }

  // 6. Envia notificações (somente após snapshot atualizado)
  for (const { msg, chatIds } of notificacoesPendentes) {
    await Promise.allSettled(
      chatIds.map(chatId =>
        fetch(EVOLUTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
          body: JSON.stringify({ number: chatId, text: msg }),
        }).catch(() => {})
      )
    )
  }

  return NextResponse.json({ ok: true, verificadas: tarefas.length, alteracoes })
}
