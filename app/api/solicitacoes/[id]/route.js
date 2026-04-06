import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import { getSession } from '../../../../lib/auth'

export async function PUT(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await request.json()
  const { nome, comando, chat_id, hora, dias_semana, ativo } = body

  try {
    const result = await query(
      `UPDATE dashboard_solicitacoes_programadas
       SET nome = $1, comando = $2, chat_id = $3, hora = $4, dias_semana = $5, ativo = $6
       WHERE id = $7 RETURNING *`,
      [nome.trim(), comando.trim(), chat_id.trim(), hora, dias_semana, ativo, params.id]
    )
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    }
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao atualizar: ' + e.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  await query('DELETE FROM dashboard_solicitacoes_programadas WHERE id = $1', [params.id])
  return NextResponse.json({ ok: true })
}
