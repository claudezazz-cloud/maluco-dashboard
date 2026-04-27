import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    const db = await query('SELECT current_database(), current_user')
    const tables = await query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `)
    return NextResponse.json({
      database: db.rows[0].current_database,
      user: db.rows[0].current_user,
      tables: tables.rows.map(r => r.table_name),
      database_url_hint: process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':***@')
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
