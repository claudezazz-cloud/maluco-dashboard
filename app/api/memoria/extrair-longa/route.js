import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'

const N8N_URL = process.env.N8N_URL || 'https://n8n.srv1537041.hstgr.cloud'
const WEBHOOK_PATH = 'memoria-longa'

export async function POST() {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  try {
    const r = await fetch(`${N8N_URL}/webhook/${WEBHOOK_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'dashboard', manual: true }),
    })

    if (!r.ok) {
      const err = await r.text()
      return NextResponse.json({ error: `N8N retornou ${r.status}: ${err.substring(0, 200)}` }, { status: 502 })
    }

    console.log('[memoria/extrair-longa] disparado via webhook')
    return NextResponse.json({ triggered: true })
  } catch (e) {
    console.error('[memoria/extrair-longa]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
