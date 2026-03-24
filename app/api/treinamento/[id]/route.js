import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PUT(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { regra } = await req.json()
  if (!regra?.trim()) return NextResponse.json({ error: 'Regra não pode ser vazia' }, { status: 400 })

  await query('UPDATE regras SET regra = $1 WHERE id = $2', [regra.trim(), params.id])
  return NextResponse.json({ ok: true })
}

export async function DELETE(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  await query('DELETE FROM regras WHERE id = $1', [params.id])
  return NextResponse.json({ ok: true })
}
