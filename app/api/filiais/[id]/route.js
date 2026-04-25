import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(req, { params }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    const filialResult = await query(
      'SELECT id, nome, n8n_workflow_id, evolution_instance, group_chat_id, ativo FROM dashboard_filiais WHERE id = $1',
      [params.id]
    )
    if (filialResult.rows.length === 0) {
      return NextResponse.json({ error: 'Filial não encontrada' }, { status: 404 })
    }
    const filial = filialResult.rows[0]

    // Fetch config entries
    let config = {}
    try {
      const configResult = await query(
        'SELECT chave, valor FROM dashboard_filiais_config WHERE filial_id = $1',
        [params.id]
      )
      for (const row of configResult.rows) {
        config[row.chave] = row.valor
      }
    } catch {
      // Config table may not exist yet
    }

    return NextResponse.json({ ...filial, config })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    const {
      nome,
      n8n_workflow_id,
      evolution_instance,
      evolution_url,
      evolution_apikey,
      group_chat_id,
      anthropic_key,
      openai_key,
      notion_token,
      notion_database_id,
      webhook_path,
      ativo,
    } = await req.json()

    await query(
      `UPDATE dashboard_filiais SET nome=$1, n8n_workflow_id=$2, evolution_instance=$3, group_chat_id=$4, ativo=$5 WHERE id=$6`,
      [nome, n8n_workflow_id, evolution_instance, group_chat_id, ativo ?? true, params.id]
    )

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

    // Update config entries
    const configEntries = [
      ['evolution_url', evolution_url],
      ['evolution_apikey', evolution_apikey],
      ['evolution_instance', evolution_instance],
      ['anthropic_key', anthropic_key],
      ['openai_key', openai_key],
      ['notion_token', notion_token],
      ['notion_database_id', notion_database_id],
      ['webhook_path', webhook_path],
    ]

    for (const [chave, valor] of configEntries) {
      if (valor !== undefined) {
        if (valor === null || valor === '') {
          await query(
            'DELETE FROM dashboard_filiais_config WHERE filial_id = $1 AND chave = $2',
            [params.id, chave]
          )
        } else {
          await query(
            'INSERT INTO dashboard_filiais_config (filial_id, chave, valor) VALUES ($1, $2, $3) ON CONFLICT (filial_id, chave) DO UPDATE SET valor = EXCLUDED.valor',
            [params.id, chave, valor]
          )
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    await query('UPDATE dashboard_filiais SET ativo = false WHERE id = $1', [params.id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
