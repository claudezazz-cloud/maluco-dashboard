import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

// Notion API constants
const NOTION_VERSION = '2022-06-28'
const NOTION_BASE = 'https://api.notion.com/v1'
const FETCH_TIMEOUT_MS = 15000
const MAX_PAGES_SAFETY = 1000

// Resolve a config value: env var > filial config
async function resolveFromDb(chave) {
  try {
    const res = await query(
      "SELECT valor FROM dashboard_filiais_config WHERE chave = $1 AND valor IS NOT NULL AND valor != '' LIMIT 1",
      [chave]
    )
    return res.rows[0]?.valor || null
  } catch {
    return null
  }
}

async function resolveNotionToken() {
  return process.env.NOTION_TOKEN || resolveFromDb('notion_token')
}

async function resolveNotionDatabaseId() {
  return process.env.NOTION_DATABASE_ID || resolveFromDb('notion_database_id')
}

// Notion property names — configurable via env, with sensible defaults
function propNames() {
  return {
    status: process.env.NOTION_STATUS_PROP || 'Status',
    tipo: process.env.NOTION_TIPO_PROP || 'Tipo',
    date: process.env.NOTION_DATE_PROP || 'Data',
    parado: process.env.NOTION_PARADO_VALUE || 'PARADO',
    internet: process.env.NOTION_INTERNET_VALUE || 'INTERNET',
  }
}

// Build Notion filter for tipo=INTERNET (all statuses) within date range
// We fetch all INTERNET tasks and categorize by status client-side
function buildFilter(startDate, endDate) {
  const p = propNames()
  const conditions = [
    { property: p.tipo, select: { equals: p.internet } },
  ]
  if (startDate) conditions.push({ property: p.date, date: { on_or_after: startDate } })
  if (endDate) conditions.push({ property: p.date, date: { on_or_before: endDate } })
  return { and: conditions }
}

async function notionRequest(token, databaseId, filter, cursor) {
  const body = { filter, page_size: 100, sorts: [{ property: propNames().date, direction: 'ascending' }] }
  if (cursor) body.start_cursor = cursor

  const res = await fetch(`${NOTION_BASE}/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })

  if (!res.ok) {
    const json = await res.json().catch(() => null)
    if (res.status === 404) throw new Error('O banco existe mas não está compartilhado com a integração. Abra o banco no Notion → ... → Connections → adicione a integração.')
    throw new Error(`Notion API ${res.status}: ${json?.message || res.status}`)
  }

  return res.json()
}

async function fetchAll(token, databaseId, filter) {
  const pages = []
  let cursor
  let hasMore = true

  while (hasMore && pages.length < MAX_PAGES_SAFETY) {
    const data = await notionRequest(token, databaseId, filter, cursor)
    pages.push(...data.results)
    hasMore = data.has_more
    cursor = data.next_cursor
  }

  return pages
}

function getPageDate(page) {
  const p = propNames()
  const prop = page.properties[p.date]
  if (prop?.date?.start) return prop.date.start.split('T')[0]
  return page.created_time?.split('T')[0] || null
}

// A task is "parada" (pending) if its Status property equals the configured PARADO value
function isParado(page) {
  const p = propNames()
  const prop = page.properties[p.status]
  if (!prop) return false
  const name = prop.select?.name || prop.status?.name || ''
  return name.toUpperCase() === p.parado.toUpperCase()
}

function aggregateByDay(pages, daysBack) {
  const map = {}
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    map[d.toISOString().split('T')[0]] = { criadas: 0, paradas: 0, concluidas: 0 }
  }

  for (const page of pages) {
    const dateStr = getPageDate(page)
    if (!dateStr || !map[dateStr]) continue
    map[dateStr].criadas++
    if (isParado(page)) map[dateStr].paradas++
    else map[dateStr].concluidas++
  }

  return Object.entries(map).map(([data, v]) => ({
    data,
    criadas: v.criadas,
    concluidas: v.concluidas,
    pendentes: v.paradas,
  }))
}

function parsePeriod(periodo, inicio, fim) {
  const hoje = new Date()
  hoje.setHours(23, 59, 59, 999)

  if (periodo === 'hoje') {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    return { startDate: start, endDate: hoje }
  }
  if (periodo === '7d') {
    const start = new Date(Date.now() - 7 * 86400000); start.setHours(0, 0, 0, 0)
    return { startDate: start, endDate: hoje }
  }
  if (periodo === 'custom' && inicio && fim) {
    const start = new Date(inicio); start.setHours(0, 0, 0, 0)
    const end = new Date(fim); end.setHours(23, 59, 59, 999)
    return { startDate: start, endDate: end }
  }
  // default: 30d
  const start = new Date(Date.now() - 30 * 86400000); start.setHours(0, 0, 0, 0)
  return { startDate: start, endDate: hoje }
}

export async function GET(req) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const periodo = searchParams.get('periodo') || '30d'
  const inicio = searchParams.get('inicio')
  const fim = searchParams.get('fim')

  const token = await resolveNotionToken()
  if (!token) {
    return NextResponse.json(
      { error: 'Token do Notion não configurado. Defina NOTION_TOKEN no ambiente ou configure em uma filial.' },
      { status: 400 }
    )
  }

  const databaseId = await resolveNotionDatabaseId()
  if (!databaseId) {
    return NextResponse.json(
      { error: 'ID do banco Notion não configurado. Defina em Admin → Filiais → Notion Database ID.' },
      { status: 400 }
    )
  }

  try {
    const { startDate, endDate } = parsePeriod(periodo, inicio, fim)

    // Fetch tasks for the selected period
    const filter = buildFilter(startDate.toISOString(), endDate.toISOString())
    const pages = await fetchAll(token, databaseId, filter)

    // Always fetch last 30d for the chart
    const chart30Start = new Date(Date.now() - 30 * 86400000)
    chart30Start.setHours(0, 0, 0, 0)
    const hoje = new Date(); hoje.setHours(23, 59, 59, 999)

    let chart30Pages = pages
    if (periodo !== '30d') {
      const chartFilter = buildFilter(chart30Start.toISOString(), hoje.toISOString())
      chart30Pages = await fetchAll(token, databaseId, chartFilter)
    }

    // Always fetch 7d for the card metric (may overlap with pages)
    const sete = new Date(Date.now() - 7 * 86400000); sete.setHours(0, 0, 0, 0)
    let setePages = pages
    if (periodo !== '7d' && periodo !== 'hoje') {
      const seteFilter = buildFilter(sete.toISOString(), hoje.toISOString())
      setePages = await fetchAll(token, databaseId, seteFilter)
    }

    // Period summary
    const totalCriadas = pages.length
    const totalParadas = pages.filter(p => isParado(p)).length
    const totalConcluidas = totalCriadas - totalParadas

    // Taxa de conclusão: tarefas resolvidas / total
    const taxaConclusao = totalCriadas > 0 ? Math.round((totalConcluidas / totalCriadas) * 100) : 0

    /*
     * Fórmula — Redução de esquecimentos:
     * Sem Notion: 100% das tarefas teriam chance de ser esquecidas (dependia de memória).
     * Com Notion: apenas tarefas AINDA PARADAS têm risco de ficarem perdidas.
     * Redução = taxa de conclusão, pois cada tarefa concluída é uma tarefa que NÃO foi esquecida.
     * Valores: 0% = nenhuma resolvida, 100% = todas resolvidas (nenhuma esquecida).
     */
    const reducaoEsquecimentos = taxaConclusao

    // Aggregate by day for chart (30d fixed)
    const grafico = aggregateByDay(chart30Pages, 30)

    // Aggregate by day for table (selected period)
    const tableDayMap = {}
    for (const page of pages) {
      const dateStr = getPageDate(page)
      if (!dateStr) continue
      if (!tableDayMap[dateStr]) tableDayMap[dateStr] = { criadas: 0, concluidas: 0, pendentes: 0 }
      tableDayMap[dateStr].criadas++
      if (isParado(page)) tableDayMap[dateStr].pendentes++
      else tableDayMap[dateStr].concluidas++
    }

    const tabela = Object.entries(tableDayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, v]) => ({ data, ...v }))

    return NextResponse.json({
      periodo: { inicio: startDate.toISOString().split('T')[0], fim: endDate.toISOString().split('T')[0] },
      resumo: {
        total7d: setePages.length,
        total30d: chart30Pages.length,
        totalCriadas,
        totalConcluidas,
        totalPendentes: totalParadas,
        taxaConclusao,
        reducaoEsquecimentos,
      },
      grafico,
      tabela,
    })
  } catch (e) {
    console.error('[metricas/notion]', e)
    const msg = e?.message || 'Erro ao buscar dados do Notion'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
