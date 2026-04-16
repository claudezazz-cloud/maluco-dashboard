import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query } from '@/lib/db'

function chatIdFor(session) {
  const email = (session.email || 'user').replace(/[^a-z0-9]/gi, '').toLowerCase()
  return `dashboard-${email}@c.us`
}

export async function GET(req) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    const chatId = chatIdFor(session)
    const { searchParams } = new URL(req.url)
    const sinceId = parseInt(searchParams.get('sinceId') || '0')

    const [conversas, mensagens] = await Promise.all([
      query(
        `SELECT id, remetente, mensagem, resposta, pops_usados, tokens_input, tokens_output, criado_em
         FROM bot_conversas WHERE chat_id = $1 AND id > $2 ORDER BY criado_em ASC LIMIT 200`,
        [chatId, sinceId]
      ),
      query(
        `SELECT id, remetente, mensagem, data_hora FROM mensagens
         WHERE chat_id = $1 ORDER BY data_hora DESC LIMIT 100`,
        [chatId]
      )
    ])

    return NextResponse.json({
      chatId,
      conversas: conversas.rows,
      mensagens: mensagens.rows.reverse()
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    const chatId = chatIdFor(session)
    await query(`DELETE FROM bot_conversas WHERE chat_id = $1`, [chatId])
    await query(`DELETE FROM mensagens WHERE chat_id = $1`, [chatId])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
