import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'
import { getWorkflow } from '@/lib/n8n'

export async function POST(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    const filialResult = await query(
      'SELECT id, nome, n8n_workflow_id, evolution_instance FROM dashboard_filiais WHERE id = $1',
      [params.id]
    )
    if (filialResult.rows.length === 0) {
      return NextResponse.json({ error: 'Filial não encontrada' }, { status: 404 })
    }
    const filial = filialResult.rows[0]

    // Load config
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
      // Config table may not exist
    }

    const results = {}

    // 1. Test N8N workflow
    if (filial.n8n_workflow_id) {
      try {
        const wf = await getWorkflow(filial.n8n_workflow_id)
        results.n8n_workflow = {
          ok: true,
          active: wf.active,
          message: wf.active ? `Workflow "${wf.name}" ativo` : `Workflow "${wf.name}" encontrado mas INATIVO`,
        }
      } catch (err) {
        results.n8n_workflow = { ok: false, message: `Erro ao acessar workflow N8N: ${err.message}` }
      }
    } else {
      results.n8n_workflow = { ok: false, message: 'Nenhum workflow N8N configurado' }
    }

    // 2. Test Evolution API
    const evolutionUrl = config.evolution_url
    const evolutionApiKey = config.evolution_apikey
    const evolutionInstance = config.evolution_instance || filial.evolution_instance

    if (evolutionUrl && evolutionApiKey && evolutionInstance) {
      try {
        const evoRes = await fetch(`${evolutionUrl}/instance/fetchInstances`, {
          headers: {
            'apikey': evolutionApiKey,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(8000),
        })
        if (evoRes.ok) {
          const evoData = await evoRes.json()
          const instances = Array.isArray(evoData) ? evoData : (evoData.data || [])
          const found = instances.find(i => i.instance?.instanceName === evolutionInstance || i.instanceName === evolutionInstance)
          if (found) {
            const state = found.instance?.state || found.state || 'unknown'
            results.evolution_api = {
              ok: state === 'open',
              message: state === 'open'
                ? `Instância "${evolutionInstance}" conectada`
                : `Instância "${evolutionInstance}" com estado: ${state}`,
            }
          } else {
            results.evolution_api = {
              ok: false,
              message: `Instância "${evolutionInstance}" não encontrada na Evolution API`,
            }
          }
        } else {
          results.evolution_api = { ok: false, message: `Evolution API retornou ${evoRes.status}` }
        }
      } catch (err) {
        results.evolution_api = { ok: false, message: `Erro ao acessar Evolution API: ${err.message}` }
      }
    } else {
      results.evolution_api = { ok: false, message: 'Evolution API não configurada (URL, chave ou instância ausentes)' }
    }

    // 3. Test Anthropic key (use filial key or fall back to main)
    const anthropicKey = config.anthropic_key || process.env.ANTHROPIC_API_KEY
    if (anthropicKey) {
      try {
        const anthRes = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          signal: AbortSignal.timeout(8000),
        })
        results.anthropic = {
          ok: anthRes.ok,
          message: anthRes.ok
            ? 'Chave Anthropic válida'
            : `Chave Anthropic inválida (status ${anthRes.status})`,
          source: config.anthropic_key ? 'filial' : 'principal',
        }
      } catch (err) {
        results.anthropic = { ok: false, message: `Erro ao validar chave Anthropic: ${err.message}` }
      }
    } else {
      results.anthropic = { ok: false, message: 'Nenhuma chave Anthropic configurada' }
    }

    // 4. Test OpenAI key
    const openaiKey = config.openai_key || process.env.OPENAI_API_KEY
    if (openaiKey) {
      try {
        const oaiRes = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${openaiKey}` },
          signal: AbortSignal.timeout(8000),
        })
        results.openai = {
          ok: oaiRes.ok,
          message: oaiRes.ok
            ? 'Chave OpenAI válida'
            : `Chave OpenAI inválida (status ${oaiRes.status})`,
          source: config.openai_key ? 'filial' : 'principal',
        }
      } catch (err) {
        results.openai = { ok: false, message: `Erro ao validar chave OpenAI: ${err.message}` }
      }
    } else {
      results.openai = { ok: false, message: 'Nenhuma chave OpenAI configurada' }
    }

    // 5. Test database connection
    try {
      await query('SELECT 1')
      results.database = { ok: true, message: 'Conexão com banco de dados OK' }
    } catch (err) {
      results.database = { ok: false, message: `Erro no banco de dados: ${err.message}` }
    }

    const allOk = Object.values(results).every(r => r.ok)
    return NextResponse.json({ ok: allOk, results })
  } catch (err) {
    console.error('test-connection error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
