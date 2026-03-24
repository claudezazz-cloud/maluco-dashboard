import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'
import { duplicateWorkflow } from '@/lib/n8n'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const result = await query('SELECT id, nome, n8n_workflow_id, evolution_instance, group_chat_id, ativo FROM dashboard_filiais ORDER BY nome')
  return NextResponse.json(result.rows)
}

export async function POST(req) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    const {
      nome,
      evolution_instance,
      evolution_url,
      evolution_apikey,
      group_chat_id,
      anthropic_key,
      openai_key,
      notion_token,
      base_workflow_id,
      webhook_path,
    } = await req.json()

    if (!nome) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

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

    // Generate webhook path from name if not provided
    const slug = webhook_path || nome.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    // Try to duplicate N8N workflow
    let n8n_workflow_id = null
    let workflowError = null
    if (base_workflow_id) {
      try {
        const newWorkflow = await duplicateWorkflow(base_workflow_id, `Bot ${nome}`, slug)
        n8n_workflow_id = newWorkflow.id
      } catch (err) {
        workflowError = err.message
      }
    }

    // Create filial record
    const filialResult = await query(
      'INSERT INTO dashboard_filiais (nome, n8n_workflow_id, evolution_instance, group_chat_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [nome, n8n_workflow_id || null, evolution_instance || null, group_chat_id || null]
    )
    const filial = filialResult.rows[0]

    // Store config entries
    const configEntries = [
      ['evolution_url', evolution_url || null],
      ['evolution_apikey', evolution_apikey || null],
      ['evolution_instance', evolution_instance || null],
      ['anthropic_key', anthropic_key || null],
      ['openai_key', openai_key || null],
      ['notion_token', notion_token || null],
      ['webhook_path', slug],
    ]

    for (const [chave, valor] of configEntries) {
      if (valor !== null && valor !== '') {
        await query(
          'INSERT INTO dashboard_filiais_config (filial_id, chave, valor) VALUES ($1, $2, $3) ON CONFLICT (filial_id, chave) DO UPDATE SET valor = EXCLUDED.valor',
          [filial.id, chave, valor]
        )
      }
    }

    const n8nUrl = process.env.N8N_URL || ''
    const webhookUrl = `${n8nUrl}/webhook/${slug}`

    return NextResponse.json({
      filial,
      webhook_url: webhookUrl,
      webhook_path: slug,
      workflow_duplicated: !!n8n_workflow_id,
      workflow_id: n8n_workflow_id,
      workflow_error: workflowError,
    }, { status: 201 })
  } catch (err) {
    console.error('POST /api/filiais error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
