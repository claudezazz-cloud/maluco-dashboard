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
      prioridade VARCHAR(20) DEFAULT 'relevante',
      ativo BOOLEAN DEFAULT true,
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `)
  // Adiciona coluna prioridade se não existir (migração)
  await query(`
    DO $$ BEGIN
      ALTER TABLE dashboard_pops ADD COLUMN IF NOT EXISTS prioridade VARCHAR(20) DEFAULT 'relevante';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
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
      "SELECT id, titulo, categoria, conteudo, COALESCE(prioridade, 'relevante') as prioridade, ativo, criado_em, atualizado_em FROM dashboard_pops ORDER BY categoria, titulo"
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
    const { titulo, categoria, conteudo, prioridade } = await req.json()
    if (!titulo?.trim()) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
    if (!conteudo?.trim()) return NextResponse.json({ error: 'Conteúdo obrigatório' }, { status: 400 })

    const validPrioridades = ['sempre', 'importante', 'relevante']
    const prio = validPrioridades.includes(prioridade) ? prioridade : 'relevante'

    const result = await query(
      'INSERT INTO dashboard_pops (titulo, categoria, conteudo, prioridade) VALUES ($1, $2, $3, $4) RETURNING *',
      [titulo.trim(), categoria?.trim() || 'Geral', conteudo.trim(), prio]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
