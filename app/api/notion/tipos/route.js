import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'

const NOTION_TOKEN = process.env.NOTION_TOKEN
const NOTION_DB = process.env.NOTION_DB || 'd54e5911e8af43dfaed8f2893e59f6ef'
const INTERNAL_TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026'

let cache = { data: null, ts: 0 }
const TTL_MS = 5 * 60 * 1000

export async function GET(req) {
  // aceita admin OU x-token (para o bot consumir tambem se precisar)
  const tok = req.headers.get('x-token')
  if (tok !== INTERNAL_TOKEN) {
    const session = await getSession()
    if (!session || !requireAdmin(session)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }
  }

  if (cache.data && Date.now() - cache.ts < TTL_MS) {
    return NextResponse.json({ tipos: cache.data, cached: true })
  }
  if (!NOTION_TOKEN) {
    return NextResponse.json({ error: 'NOTION_TOKEN não configurado no env' }, { status: 500 })
  }

  try {
    const r = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB}`, {
      headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' }
    })
    const data = await r.json()
    if (!r.ok) return NextResponse.json({ error: data.message || r.statusText }, { status: r.status })
    const opts = data?.properties?.Tipo?.multi_select?.options || []
    const tipos = opts.map(o => ({ name: o.name, color: o.color || 'default' }))
    cache = { data: tipos, ts: Date.now() }
    return NextResponse.json({ tipos })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
