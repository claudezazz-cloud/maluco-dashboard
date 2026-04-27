import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query } from '@/lib/db'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS bot_erros (
      id SERIAL PRIMARY KEY,
      no_n8n VARCHAR(255) DEFAULT 'Desconhecido',
      mensagem_erro TEXT,
      mensagem_usuario TEXT DEFAULT '',
      chat_id VARCHAR(255) DEFAULT '',
      criado_em TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_bot_erros_criado_em ON bot_erros(criado_em DESC)`)
}

export async function GET(req) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    await ensureTable()
    const result = await query(
      `SELECT * FROM bot_erros ORDER BY criado_em DESC LIMIT 100`
    )
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Chamado pelo N8N ao capturar erro
export async function POST(req) {
  const token = req.headers.get('x-token')
  const expectedToken = process.env.N8N_POPS_TOKEN || 'MALUCO_POPS_2026'
  if (token !== expectedToken) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    await ensureTable()
    const { no_n8n, mensagem_erro, mensagem_usuario, chat_id } = await req.json()
    await query(
      `INSERT INTO bot_erros (no_n8n, mensagem_erro, mensagem_usuario, chat_id)
       VALUES ($1, $2, $3, $4)`,
      [no_n8n || 'Desconhecido', mensagem_erro || '', mensagem_usuario || '', chat_id || '']
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    await query(`DELETE FROM bot_erros WHERE criado_em < NOW() - INTERVAL '7 days'`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
