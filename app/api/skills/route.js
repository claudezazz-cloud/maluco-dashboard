import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS dashboard_skills (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(50) NOT NULL UNIQUE,
      descricao TEXT,
      prompt_base TEXT NOT NULL,
      parametros_opcionais JSONB DEFAULT '[]',
      ativo BOOLEAN DEFAULT true,
      criado_em TIMESTAMP DEFAULT NOW()
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
      'SELECT id, nome, descricao, prompt_base, parametros_opcionais, ativo, criado_em FROM dashboard_skills ORDER BY nome ASC'
    )
    return NextResponse.json(result.rows)
  } catch (e) {
    console.error('GET /skills:', e.message)
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
    const { nome, descricao, prompt_base, parametros_opcionais } = await req.json()
    if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    if (!prompt_base?.trim()) return NextResponse.json({ error: 'Prompt base obrigatório' }, { status: 400 })

    const nomeNormalizado = nome.trim().startsWith('/') ? nome.trim().toLowerCase() : '/' + nome.trim().toLowerCase()

    let params = '[]'
    if (parametros_opcionais) {
      try {
        params = typeof parametros_opcionais === 'string' ? parametros_opcionais : JSON.stringify(parametros_opcionais)
        JSON.parse(params)
      } catch {
        return NextResponse.json({ error: 'parametros_opcionais deve ser JSON válido' }, { status: 400 })
      }
    }

    const result = await query(
      'INSERT INTO dashboard_skills (nome, descricao, prompt_base, parametros_opcionais) VALUES ($1, $2, $3, $4) RETURNING *',
      [nomeNormalizado, descricao?.trim() || null, prompt_base.trim(), params]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (e) {
    if (e.code === '23505') {
      return NextResponse.json({ error: 'Já existe uma skill com esse nome' }, { status: 409 })
    }
    console.error('POST /skills:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
