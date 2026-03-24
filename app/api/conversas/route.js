import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query } from '@/lib/db'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS bot_conversas (
      id SERIAL PRIMARY KEY,
      chat_id VARCHAR(255),
      remetente VARCHAR(255),
      mensagem TEXT,
      resposta TEXT,
      pops_usados TEXT DEFAULT '',
      tokens_input INTEGER DEFAULT 0,
      tokens_output INTEGER DEFAULT 0,
      criado_em TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_bot_conversas_chat_id ON bot_conversas(chat_id)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_bot_conversas_criado_em ON bot_conversas(criado_em DESC)`)
}

export async function GET(req) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    await ensureTable()
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '30'))
    const busca = searchParams.get('busca') || ''
    const offset = (page - 1) * limit

    let where = busca
      ? `WHERE mensagem ILIKE $3 OR resposta ILIKE $3 OR remetente ILIKE $3`
      : ''
    const params = busca ? [limit, offset, `%${busca}%`] : [limit, offset]

    const [rows, countRow] = await Promise.all([
      query(`SELECT * FROM bot_conversas ${where} ORDER BY criado_em DESC LIMIT $1 OFFSET $2`, params),
      query(`SELECT COUNT(*) FROM bot_conversas ${where}`, busca ? [`%${busca}%`] : [])
    ])

    return NextResponse.json({
      conversas: rows.rows,
      total: parseInt(countRow.rows[0].count),
      page,
      limit,
      totalPages: Math.ceil(parseInt(countRow.rows[0].count) / limit)
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Chamado pelo N8N para salvar cada conversa
export async function POST(req) {
  try {
    await ensureTable()
    const { chat_id, remetente, mensagem, resposta, pops_usados, tokens_input, tokens_output } = await req.json()
    await query(
      `INSERT INTO bot_conversas (chat_id, remetente, mensagem, resposta, pops_usados, tokens_input, tokens_output)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [chat_id || '', remetente || '', (mensagem || '').substring(0, 2000),
       (resposta || '').substring(0, 4000), pops_usados || '', tokens_input || 0, tokens_output || 0]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
