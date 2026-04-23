import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PUT(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { nome, cargo, funcoes, telefone_whatsapp } = await req.json()
  const tel = (telefone_whatsapp || '').replace(/\D/g, '') || null
  await query(
    'UPDATE dashboard_colaboradores SET nome=$1, cargo=$2, funcoes=$3, telefone_whatsapp=$4 WHERE id=$5',
    [nome, cargo || null, funcoes || null, tel, params.id]
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await query('UPDATE dashboard_colaboradores SET ativo = false WHERE id = $1', [params.id])
  return NextResponse.json({ ok: true })
}
