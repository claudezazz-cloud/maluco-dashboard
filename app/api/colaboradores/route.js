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
  await query(`ALTER TABLE dashboard_colaboradores ADD COLUMN IF NOT EXISTS telefone_whatsapp VARCHAR(20)`)
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
    const { nome, cargo, funcoes, telefone_whatsapp } = await req.json()
    if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    const tel = (telefone_whatsapp || '').replace(/\D/g, '') || null
    const result = await query(
      'INSERT INTO dashboard_colaboradores (nome, cargo, funcoes, telefone_whatsapp) VALUES ($1, $2, $3, $4) RETURNING *',
      [nome.trim(), cargo?.trim() || null, funcoes?.trim() || null, tel]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
