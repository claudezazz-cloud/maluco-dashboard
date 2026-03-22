import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PUT(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { nome, n8n_workflow_id, evolution_instance, group_chat_id, ativo } = await req.json()
  await query(
    `UPDATE dashboard_filiais SET nome=$1, n8n_workflow_id=$2, evolution_instance=$3, group_chat_id=$4, ativo=$5 WHERE id=$6`,
    [nome, n8n_workflow_id, evolution_instance, group_chat_id, ativo ?? true, params.id]
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  await query('UPDATE dashboard_filiais SET ativo = false WHERE id = $1', [params.id])
  return NextResponse.json({ ok: true })
}
