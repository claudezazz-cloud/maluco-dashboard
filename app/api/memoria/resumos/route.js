import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession, requireAdmin } from '@/lib/auth'

export async function GET(request) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  if (process.env.MEMORIA_ENABLED !== 'true') {
    return NextResponse.json([])
  }

  const { searchParams } = new URL(request.url)
  const chatId = searchParams.get('chatId') || null
  const limit  = Math.min(parseInt(searchParams.get('limit') || '60'), 200)

  try {
    const params = chatId ? [chatId, limit] : [limit]
    const where  = chatId ? 'WHERE chat_id = $1' : ''
    const result = await query(
      `SELECT id, chat_id, data, resumo, total_mensagens,
              solicitacoes_abertas, solicitacoes_resolvidas,
              decisoes, pessoas_ativas, gerado_em
       FROM bot_memoria_dia
       ${where}
       ORDER BY data DESC, gerado_em DESC
       LIMIT ${chatId ? '$2' : '$1'}`,
      params
    )
    return NextResponse.json(result.rows)
  } catch (e) {
    console.error('[memoria/resumos]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
