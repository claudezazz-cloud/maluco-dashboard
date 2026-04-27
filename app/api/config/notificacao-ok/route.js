import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

const CHAVE = 'grupo_notificacao_ok'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS dashboard_config (
      id SERIAL PRIMARY KEY,
      chave VARCHAR(255) UNIQUE NOT NULL,
      valor TEXT,
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `)
}

export async function GET() {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
  try {
    await ensureTable()
    const r = await query(`SELECT valor FROM dashboard_config WHERE chave = $1`, [CHAVE])
    return NextResponse.json({ grupo: r.rows[0]?.valor || '' })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
  try {
    const { grupo } = await req.json()
    const valor = (grupo || '').trim()
    await ensureTable()
    if (valor) {
      await query(
        `INSERT INTO dashboard_config (chave, valor, atualizado_em) VALUES ($1, $2, NOW())
         ON CONFLICT (chave) DO UPDATE SET valor = $2, atualizado_em = NOW()`,
        [CHAVE, valor]
      )
    } else {
      await query(`DELETE FROM dashboard_config WHERE chave = $1`, [CHAVE])
    }
    return NextResponse.json({ ok: true, grupo: valor })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
