import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'
import { duplicateWorkflow } from '@/lib/n8n'

export async function POST(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    const { base_workflow_id, webhook_path } = await req.json()
    if (!base_workflow_id) return NextResponse.json({ error: 'base_workflow_id obrigatório' }, { status: 400 })

    const filialResult = await query(
      'SELECT id, nome FROM dashboard_filiais WHERE id = $1',
      [params.id]
    )
    if (filialResult.rows.length === 0) {
      return NextResponse.json({ error: 'Filial não encontrada' }, { status: 404 })
    }
    const filial = filialResult.rows[0]

    // Determine webhook path
    let slug = webhook_path
    if (!slug) {
      // Try to get from config
      try {
        const cfgResult = await query(
          "SELECT valor FROM dashboard_filiais_config WHERE filial_id = $1 AND chave = 'webhook_path'",
          [params.id]
        )
        slug = cfgResult.rows[0]?.valor
      } catch {
        // ignore
      }
    }
    if (!slug) {
      slug = filial.nome.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    }

    const newWorkflow = await duplicateWorkflow(base_workflow_id, `Bot ${filial.nome}`, slug)

    // Update filial record with new workflow id
    await query(
      'UPDATE dashboard_filiais SET n8n_workflow_id = $1 WHERE id = $2',
      [newWorkflow.id, params.id]
    )

    // Store webhook path in config
    try {
      await query(
        'INSERT INTO dashboard_filiais_config (filial_id, chave, valor) VALUES ($1, $2, $3) ON CONFLICT (filial_id, chave) DO UPDATE SET valor = EXCLUDED.valor',
        [params.id, 'webhook_path', slug]
      )
    } catch {
      // ignore if table not ready
    }

    const n8nUrl = process.env.N8N_URL || ''
    const webhookUrl = `${n8nUrl}/webhook/${slug}`

    return NextResponse.json({
      ok: true,
      workflow_id: newWorkflow.id,
      workflow_name: newWorkflow.name,
      webhook_url: webhookUrl,
      webhook_path: slug,
    })
  } catch (err) {
    console.error('duplicate-workflow error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
