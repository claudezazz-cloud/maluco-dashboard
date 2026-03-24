import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS dashboard_pops (
      id SERIAL PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      categoria VARCHAR(255),
      conteudo TEXT NOT NULL,
      ativo BOOLEAN DEFAULT true,
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
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
    const result = await query(
      'SELECT id, titulo, categoria, conteudo, ativo, criado_em, atualizado_em FROM dashboard_pops ORDER BY categoria, titulo'
    )
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
    const { titulo, categoria, conteudo } = await req.json()
    if (!titulo?.trim()) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
    if (!conteudo?.trim()) return NextResponse.json({ error: 'Conteúdo obrigatório' }, { status: 400 })

    const result = await query(
      'INSERT INTO dashboard_pops (titulo, categoria, conteudo) VALUES ($1, $2, $3) RETURNING *',
      [titulo.trim(), categoria?.trim() || 'Geral', conteudo.trim()]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
