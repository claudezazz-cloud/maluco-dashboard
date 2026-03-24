import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

export async function POST(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    const results = {}

    // Ensure config table exists
    await query(`
      CREATE TABLE IF NOT EXISTS dashboard_filiais_config (
        id SERIAL PRIMARY KEY,
        filial_id INTEGER REFERENCES dashboard_filiais(id) ON DELETE CASCADE,
        chave VARCHAR(255) NOT NULL,
        valor TEXT,
        UNIQUE(filial_id, chave)
      )
    `)
    results.config_table = { ok: true, message: 'Tabela dashboard_filiais_config OK' }

    // Verify the filial exists
    const filialResult = await query(
      'SELECT id, nome, group_chat_id FROM dashboard_filiais WHERE id = $1',
      [params.id]
    )
    if (filialResult.rows.length === 0) {
      return NextResponse.json({ error: 'Filial não encontrada' }, { status: 404 })
    }
    const filial = filialResult.rows[0]
    results.filial = { ok: true, message: `Filial "${filial.nome}" encontrada` }

    // Check mensagens table (shared, filtered by chat_id)
    try {
      const testQuery = await query(
        'SELECT COUNT(*) as count FROM mensagens WHERE chat_id = $1 LIMIT 1',
        [filial.group_chat_id || '']
      )
      results.mensagens_table = {
        ok: true,
        message: `Tabela mensagens OK - ${testQuery.rows[0].count} mensagens para este grupo`,
      }
    } catch (err) {
      results.mensagens_table = {
        ok: false,
        message: `Tabela mensagens: ${err.message}`,
      }
    }

    // Check regras table (shared)
    try {
      const testQuery = await query('SELECT COUNT(*) as count FROM regras LIMIT 1')
      results.regras_table = {
        ok: true,
        message: `Tabela regras OK - ${testQuery.rows[0].count} regras cadastradas`,
      }
    } catch (err) {
      results.regras_table = {
        ok: false,
        message: `Tabela regras: ${err.message}`,
      }
    }

    const allOk = Object.values(results).every(r => r.ok)
    return NextResponse.json({ ok: allOk, results })
  } catch (err) {
    console.error('setup-db error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
