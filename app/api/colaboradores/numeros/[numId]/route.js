import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PUT(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    const id = parseInt(params.numId)
    const { apelido } = await req.json()
    const r = await query(
      'UPDATE colaboradores_numeros SET apelido = $1 WHERE id = $2 RETURNING *',
      [apelido?.trim() || null, id]
    )
    if (!r.rows.length) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    return NextResponse.json(r.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    const id = parseInt(params.numId)
    await query('DELETE FROM colaboradores_numeros WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
