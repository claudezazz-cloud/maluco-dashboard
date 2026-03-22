import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query } from '@/lib/db'
import { getWorkflow, getExecutions } from '@/lib/n8n'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    const filiaisResult = await query('SELECT * FROM dashboard_filiais WHERE ativo = true ORDER BY nome')
    const filiais = filiaisResult.rows

    const results = await Promise.all(filiais.map(async (filial) => {
      let workflow = null
      let executions = []
      let online = false
      let lastExecution = null
      let errorCount = 0

      try {
        if (filial.n8n_workflow_id) {
          workflow = await getWorkflow(filial.n8n_workflow_id)
          online = workflow?.active === true

          const execData = await getExecutions(filial.n8n_workflow_id, 50)
          executions = execData?.data || []
          lastExecution = executions[0] || null

          const today = new Date().toISOString().split('T')[0]
          errorCount = executions.filter(e =>
            e.status === 'error' && e.startedAt?.startsWith(today)
          ).length
        }
      } catch (e) {
        online = false
      }

      // Mensagens hoje
      let mensagensHoje = 0
      try {
        const chatId = filial.group_chat_id
        if (chatId) {
          const msgResult = await query(
            `SELECT COUNT(*) as total FROM mensagens WHERE chat_id = $1 AND DATE(data_hora) = CURRENT_DATE`,
            [chatId]
          )
          mensagensHoje = parseInt(msgResult.rows[0]?.total || 0)
        }
      } catch {}

      return {
        id: filial.id,
        nome: filial.nome,
        online,
        workflowNome: workflow?.name || null,
        ultimaExecucao: lastExecution ? {
          id: lastExecution.id,
          status: lastExecution.status,
          inicio: lastExecution.startedAt,
          duracao: lastExecution.stoppedAt
            ? Math.round((new Date(lastExecution.stoppedAt) - new Date(lastExecution.startedAt)) / 1000)
            : null,
        } : null,
        errosHoje: errorCount,
        mensagensHoje,
      }
    }))

    return NextResponse.json(results)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro ao buscar status' }, { status: 500 })
  }
}
