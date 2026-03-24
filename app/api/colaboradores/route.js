import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS dashboard_colaboradores (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      cargo VARCHAR(255),
      funcoes TEXT,
      ativo BOOLEAN DEFAULT true
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
    const result = await query('SELECT * FROM dashboard_colaboradores WHERE ativo = true ORDER BY nome')
    return NextResponse.json(result.rows)
  } catch (e) {
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
    const { nome, cargo, funcoes } = await req.json()
    if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    const result = await query(
      'INSERT INTO dashboard_colaboradores (nome, cargo, funcoes) VALUES ($1, $2, $3) RETURNING *',
      [nome.trim(), cargo?.trim() || null, funcoes?.trim() || null]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
