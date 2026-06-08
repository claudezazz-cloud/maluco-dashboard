import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NOTION_TOKEN = process.env.NOTION_TOKEN
const NOTION_DB = 'd54e5911e8af43dfaed8f2893e59f6ef' // Mesmo DB usado no sync-snapshot

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
  return { id: p.id, titulo, status, responsavel, entrega, tipo }
}

async function fetchAllTarefas() {
  const results = []
  let hasMore = true
  let startCursor = undefined

  while (hasMore) {
    const body = {
      filter: { 
        and: [
          { property: 'status', select: { does_not_equal: 'Ok' } },
          { property: 'status', select: { does_not_equal: 'Cancelado' } }
        ]
      },
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
      throw new Error(`Notion error: ${err.slice(0, 200)}`)
    }

    const data = await res.json()
    results.push(...(data.results || []))
    hasMore = data.has_more || false
    startCursor = data.next_cursor
  }

  return results.map(parseTask)
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    const tarefas = await fetchAllTarefas()
    return NextResponse.json(tarefas)
  } catch (e) {
    console.error('[API TAREFAS ERROR]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
