import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PUT(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { nome, cargo, funcoes } = await req.json()
  await query(
    'UPDATE dashboard_colaboradores SET nome=$1, cargo=$2, funcoes=$3 WHERE id=$4',
    [nome, cargo || null, funcoes || null, params.id]
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await query('UPDATE dashboard_colaboradores SET ativo = false WHERE id = $1', [params.id])
  return NextResponse.json({ ok: true })
}
