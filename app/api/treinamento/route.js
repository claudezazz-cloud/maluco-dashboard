import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS regras (
      id SERIAL PRIMARY KEY,
      regra TEXT NOT NULL
    )
  `)
}

export async function GET() {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  try {
    await ensureTable()
    const result = await query('SELECT id, regra FROM regras ORDER BY id ASC')
    return NextResponse.json(result.rows)
  } catch (e) {
    console.error('GET /treinamento:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  try {
    await ensureTable()
    const { regra } = await req.json()
    if (!regra?.trim()) return NextResponse.json({ error: 'Regra não pode ser vazia' }, { status: 400 })

    const result = await query(
      'INSERT INTO regras (regra) VALUES ($1) RETURNING *',
      [regra.trim()]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (e) {
    console.error('POST /treinamento:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
