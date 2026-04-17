import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query } from '@/lib/db'
import { getExecutions } from '@/lib/n8n'

export async function GET(req) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const filialId = searchParams.get('filialId')

  try {
    let workflowId = null
    if (filialId) {
      const r = await query('SELECT n8n_workflow_id FROM dashboard_filiais WHERE id = $1', [filialId])
      workflowId = r.rows[0]?.n8n_workflow_id || null
    }

    // Sem workflow_id configurado: busca todas as execuções recentes do N8N como fallback
    const data = await getExecutions(workflowId, 30)
    const executions = (data?.data || []).map(e => ({
      id: e.id,
      status: e.status,
      inicio: e.startedAt,
      fim: e.stoppedAt,
      duracao: e.stoppedAt
        ? Math.round((new Date(e.stoppedAt) - new Date(e.startedAt)) / 1000)
        : null,
      modo: e.mode,
    }))

    return NextResponse.json(executions)
  } catch (e) {
    console.error('executions error:', e?.message || e)
    // Silenciosamente retorna vazio — a UI já trata "Nenhuma execução encontrada"
    return NextResponse.json([])
  }
}
