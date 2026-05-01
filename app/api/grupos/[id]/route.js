import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PUT(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    const { id } = await params
    const { nome, chat_id, descricao, ativo, bom_dia, alertas_notion_entrega, alertas_notion_ok, tipos_filtro_entrega, tipos_filtro_ok } = await req.json()
    const r = await query(
      `UPDATE grupos_whatsapp SET
        nome = COALESCE($1, nome),
        chat_id = COALESCE($2, chat_id),
        descricao = COALESCE($3, descricao),
        ativo = COALESCE($4, ativo),
        bom_dia = COALESCE($5, bom_dia),
        alertas_notion_entrega = COALESCE($6, alertas_notion_entrega),
        alertas_notion_ok = COALESCE($7, alertas_notion_ok),
        tipos_filtro_entrega = COALESCE($8, tipos_filtro_entrega),
        tipos_filtro_ok = COALESCE($9, tipos_filtro_ok),
        atualizado_em = NOW()
       WHERE id = $10 RETURNING *`,
      [nome ?? null, chat_id ?? null, descricao ?? null, ativo ?? null, bom_dia ?? null, alertas_notion_entrega ?? null, alertas_notion_ok ?? null, tipos_filtro_entrega ?? null, tipos_filtro_ok ?? null, id]
    )
    if (!r.rows[0]) return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })
    return NextResponse.json(r.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    const { id } = await params
    await query('DELETE FROM grupos_whatsapp WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
