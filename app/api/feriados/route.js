import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function ensureTable() {
  await query(`CREATE TABLE IF NOT EXISTS feriados (
    id SERIAL PRIMARY KEY,
    data DATE UNIQUE NOT NULL,
    descricao TEXT NOT NULL,
    tipo VARCHAR(20) DEFAULT 'feriado',
    criado_em TIMESTAMPTZ DEFAULT NOW()
  )`)
}

// GET — lista feriados de hoje pra frente (passados ficam fora pra não poluir).
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await ensureTable()
  const r = await query(
    `SELECT id, to_char(data,'YYYY-MM-DD') AS data, descricao, tipo
     FROM feriados
     WHERE data >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date - INTERVAL '3 days'
     ORDER BY data ASC`
  )
  return NextResponse.json(r.rows)
}

// POST — adiciona/atualiza um feriado.
export async function POST(req) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { data, descricao, tipo } = await req.json().catch(() => ({}))
  if (!data || !descricao) return NextResponse.json({ error: 'data e descricao são obrigatórios' }, { status: 400 })
  await ensureTable()
  try {
    const r = await query(
      `INSERT INTO feriados (data, descricao, tipo) VALUES ($1, $2, $3)
       ON CONFLICT (data) DO UPDATE SET descricao = EXCLUDED.descricao, tipo = EXCLUDED.tipo
       RETURNING id, to_char(data,'YYYY-MM-DD') AS data, descricao, tipo`,
      [data, descricao, tipo || 'feriado']
    )
    return NextResponse.json(r.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE ?id=N — remove um feriado.
export async function DELETE(req) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await query('DELETE FROM feriados WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}
