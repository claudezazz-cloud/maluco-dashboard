import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const result = await query('SELECT id, nome, n8n_workflow_id, evolution_instance, group_chat_id, ativo FROM dashboard_filiais ORDER BY nome')
  return NextResponse.json(result.rows)
}

export async function POST(req) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { nome, n8n_workflow_id, evolution_instance, group_chat_id } = await req.json()
  if (!nome) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const result = await query(
    'INSERT INTO dashboard_filiais (nome, n8n_workflow_id, evolution_instance, group_chat_id) VALUES ($1, $2, $3, $4) RETURNING *',
    [nome, n8n_workflow_id || null, evolution_instance || null, group_chat_id || null]
  )
  return NextResponse.json(result.rows[0], { status: 201 })
}
