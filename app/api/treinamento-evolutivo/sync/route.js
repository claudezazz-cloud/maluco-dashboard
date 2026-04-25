import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'
import { sincronizar, ensureTables } from '@/lib/evolutivo/indexer'

export async function POST(req) {
  // Aceita autenticação por token (para cron) ou sessão admin
  const cronToken = req.headers.get('x-token')
  const expectedToken = process.env.EVOLUTIVO_SYNC_TOKEN || 'EVOLUTIVO_SYNC_2026'
  if (cronToken !== expectedToken) {
    const session = await getSession()
    if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  await ensureTables()

  const srcRes = await query('SELECT id FROM evolutive_sources WHERE ativo = true LIMIT 1')
  if (!srcRes.rows[0]) return NextResponse.json({ error: 'Nenhuma fonte configurada. Configure a pasta primeiro.' }, { status: 400 })

  try {
    const resultado = await sincronizar(srcRes.rows[0].id)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (e) {
    console.error('[treinamento-evolutivo/sync]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
