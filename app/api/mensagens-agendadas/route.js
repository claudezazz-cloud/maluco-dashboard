import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

// GET /api/mensagens-agendadas?status=pendente,processando&limit=100
export async function GET(req) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status') || 'pendente,processando'
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
  const statuses = statusFilter.split(',').map(s => s.trim()).filter(Boolean)
  const placeholders = statuses.map((_, i) => `$${i + 1}`).join(',')

  const res = await query(
    `SELECT ma.id, ma.mensagem, ma.agendar_para, ma.status, ma.tentativas,
            ma.criado_por, ma.criado_em, ma.dedup_key,
            g.nome AS grupo_nome, g.chat_id
     FROM mensagens_agendadas ma
     LEFT JOIN grupos_whatsapp g ON g.id = ma.grupo_id
     WHERE ma.status IN (${placeholders})
     ORDER BY ma.agendar_para ASC
     LIMIT ${limit}`,
    statuses
  )

  return NextResponse.json({ mensagens: res.rows })
}

// DELETE /api/mensagens-agendadas?id=123
export async function DELETE(req) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })

  await query(
    `UPDATE mensagens_agendadas SET status = 'cancelado' WHERE id = $1 AND status IN ('pendente', 'processando')`,
    [id]
  )
  return NextResponse.json({ ok: true })
}
