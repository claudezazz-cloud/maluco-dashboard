import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS colaboradores_numeros (
      id SERIAL PRIMARY KEY,
      colaborador_id INT NOT NULL REFERENCES dashboard_colaboradores(id) ON DELETE CASCADE,
      numero VARCHAR(32) NOT NULL UNIQUE,
      apelido VARCHAR(120),
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_colab_numeros_numero ON colaboradores_numeros(numero)`)
  // migra telefone_whatsapp existente uma vez
  await query(`
    INSERT INTO colaboradores_numeros (colaborador_id, numero, apelido)
    SELECT id, telefone_whatsapp, 'principal'
    FROM dashboard_colaboradores
    WHERE telefone_whatsapp IS NOT NULL AND telefone_whatsapp <> ''
      AND NOT EXISTS (SELECT 1 FROM colaboradores_numeros cn WHERE cn.numero = dashboard_colaboradores.telefone_whatsapp)
    ON CONFLICT (numero) DO NOTHING
  `)
}

const sanitize = (n) => (n || '').replace(/\D/g, '')

export async function GET(_req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    await ensureTable()
    const id = parseInt(params.id)
    const r = await query('SELECT id, numero, apelido, criado_em FROM colaboradores_numeros WHERE colaborador_id = $1 ORDER BY criado_em', [id])
    return NextResponse.json(r.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    await ensureTable()
    const id = parseInt(params.id)
    const { numero, apelido } = await req.json()
    const num = sanitize(numero)
    if (!num) return NextResponse.json({ error: 'Número inválido' }, { status: 400 })
    const r = await query(
      'INSERT INTO colaboradores_numeros (colaborador_id, numero, apelido) VALUES ($1, $2, $3) RETURNING *',
      [id, num, apelido?.trim() || null]
    )
    return NextResponse.json(r.rows[0], { status: 201 })
  } catch (e) {
    if (e.code === '23505') return NextResponse.json({ error: 'Número já cadastrado' }, { status: 409 })
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
