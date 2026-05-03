import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026'

// POST /api/lembretes — usado pelo bot (tool criar_lembrete)
// Body: { chat_id, mensagem, agendar_para (ISO), criado_por? }
// Resolve o grupo pelo chat_id e insere em mensagens_agendadas.
export async function POST(req) {
  const tok = req.headers.get('x-token')
  if (tok !== TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const { chat_id, mensagem, agendar_para, criado_por } = await req.json()
    if (!chat_id || !mensagem || !agendar_para) {
      return NextResponse.json({ error: 'chat_id, mensagem e agendar_para obrigatorios' }, { status: 400 })
    }

    // Resolve grupo pelo chat_id
    const gRes = await query(
      `SELECT id, nome FROM grupos_whatsapp WHERE chat_id = $1 AND ativo = true LIMIT 1`,
      [chat_id]
    )
    if (!gRes.rows.length) {
      return NextResponse.json({ error: `Grupo com chat_id ${chat_id} nao encontrado ou inativo` }, { status: 404 })
    }
    const grupo = gRes.rows[0]

    const r = await query(
      `INSERT INTO mensagens_agendadas (grupo_id, mensagem, agendar_para, criado_por, status)
       VALUES ($1, $2, $3, $4, 'pendente')
       RETURNING id, agendar_para`,
      [grupo.id, mensagem.trim().substring(0, 2000), agendar_para, criado_por || 'bot']
    )
    const row = r.rows[0]
    return NextResponse.json({ ok: true, id: row.id, grupo: grupo.nome, agendar_para: row.agendar_para })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
