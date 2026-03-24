import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PUT(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { titulo, categoria, conteudo, ativo } = await req.json()
  if (!titulo?.trim() || !conteudo?.trim()) return NextResponse.json({ error: 'Título e conteúdo obrigatórios' }, { status: 400 })

  await query(
    `UPDATE dashboard_pops SET titulo=$1, categoria=$2, conteudo=$3, ativo=$4, atualizado_em=NOW() WHERE id=$5`,
    [titulo.trim(), categoria?.trim() || 'Geral', conteudo.trim(), ativo ?? true, params.id]
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  await query('UPDATE dashboard_pops SET ativo = false WHERE id = $1', [params.id])
  return NextResponse.json({ ok: true })
}
