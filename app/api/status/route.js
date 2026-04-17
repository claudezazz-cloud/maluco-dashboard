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
      let lastExecution = null

      try {
        if (filial.n8n_workflow_id) {
          workflow = await getWorkflow(filial.n8n_workflow_id)
          const execData = await getExecutions(filial.n8n_workflow_id, 50)
          executions = execData?.data || []
          lastExecution = executions[0] || null
        }
      } catch {}

      // Mensagens hoje (timezone America/Sao_Paulo)
      // Fix: usar (data_hora AT TIME ZONE 'America/Sao_Paulo')::date
      // CURRENT_DATE AT TIME ZONE é sintaxe inválida em Postgres
      let mensagensHoje = 0
      try {
        const chatId = filial.group_chat_id
        const baseQuery = `
          SELECT COUNT(*)::int AS total FROM mensagens
          WHERE (data_hora AT TIME ZONE 'America/Sao_Paulo')::date
              = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
        `
        const r = chatId
          ? await query(baseQuery + ' AND chat_id = $1', [chatId])
          : await query(baseQuery)
        mensagensHoje = r.rows[0]?.total || 0
      } catch {}

      // Erros hoje — fonte primária: bot_erros (populada pelo próprio workflow)
      // Fallback: contagem de execuções do N8N com status 'error'
      let errosHoje = 0
      try {
        const chatId = filial.group_chat_id
        const baseQuery = `
          SELECT COUNT(*)::int AS total FROM bot_erros
          WHERE (criado_em AT TIME ZONE 'America/Sao_Paulo')::date
              = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
        `
        const r = chatId
          ? await query(baseQuery + ' AND chat_id = $1', [chatId])
          : await query(baseQuery)
        errosHoje = r.rows[0]?.total || 0
      } catch {
        // Fallback para execuções do N8N se a tabela bot_erros não existir ainda
        const today = new Date().toISOString().split('T')[0]
        errosHoje = executions.filter(e => e.status === 'error' && e.startedAt?.startsWith(today)).length
      }

      // "Online" — considerado online se:
      //   1) workflow.active === true (quando workflow_id configurado), OU
      //   2) houve pelo menos uma mensagem no chat nos últimos 15 minutos (heurística)
      let online = workflow?.active === true
      if (!online) {
        try {
          const chatId = filial.group_chat_id
          const recenteQuery = `
            SELECT 1 FROM mensagens
            WHERE data_hora >= NOW() - INTERVAL '15 minutes'
            ${chatId ? 'AND chat_id = $1' : ''}
            LIMIT 1
          `
          const r = chatId ? await query(recenteQuery, [chatId]) : await query(recenteQuery)
          if (r.rows.length > 0) online = true
        } catch {}
      }

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
        errosHoje,
        mensagensHoje,
      }
    }))

    return NextResponse.json(results)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro ao buscar status' }, { status: 500 })
  }
}
