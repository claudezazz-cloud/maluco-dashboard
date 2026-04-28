import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import { getSession } from '../../../lib/auth'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS dashboard_solicitacoes_programadas (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(100) NOT NULL,
      comando TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      hora VARCHAR(5) NOT NULL,
      dias_semana VARCHAR(50) DEFAULT 'seg,ter,qua,qui,sex',
      ativo BOOLEAN DEFAULT true,
      ultimo_executado TIMESTAMP,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `)
  await query(`ALTER TABLE dashboard_solicitacoes_programadas ALTER COLUMN chat_id TYPE TEXT`).catch(() => {})
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  await ensureTable()
  const result = await query(
    'SELECT * FROM dashboard_solicitacoes_programadas ORDER BY hora ASC, nome ASC'
  )
  return NextResponse.json(result.rows)
}

export async function POST(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  await ensureTable()

  const body = await request.json()
  const { nome, comando, chat_id, hora, dias_semana } = body

  if (!nome || !comando || !chat_id || !hora) {
    return NextResponse.json({ error: 'Campos obrigatórios: nome, comando, chat_id, hora' }, { status: 400 })
  }

  try {
    const result = await query(
      `INSERT INTO dashboard_solicitacoes_programadas (nome, comando, chat_id, hora, dias_semana)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nome.trim(), comando.trim(), chat_id.trim(), hora, dias_semana || 'seg,ter,qua,qui,sex']
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao criar solicitação: ' + e.message }, { status: 500 })
  }
}
