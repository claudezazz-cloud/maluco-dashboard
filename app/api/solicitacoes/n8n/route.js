import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'

function checkToken(request) {
  const token = request.headers.get('x-token')
  return token === process.env.N8N_POPS_TOKEN
}

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
}

export async function GET(request) {
  console.log('[n8n-tasks-get] Iniciando busca de tarefas')
  if (!checkToken(request)) {
    console.warn('[n8n-tasks-get] Unauthorized: Token inválido')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Hora atual no Brasil (UTC-3)
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const horaAtual = now.toTimeString().slice(0, 5)
  const diasMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
  const diaAtual = diasMap[now.getDay()]

  console.log(`[n8n-tasks-get] Consultando para ${diaAtual} às ${horaAtual}`)

  try {
    await ensureTable()
    const result = await query(
      `SELECT * FROM dashboard_solicitacoes_programadas
       WHERE ativo = true
         AND hora = $1
         AND (dias_semana = 'todos' OR dias_semana LIKE '%' || $2 || '%')
         AND (ultimo_executado IS NULL
              OR ultimo_executado < NOW() - INTERVAL '50 minutes')
       ORDER BY id ASC`,
      [horaAtual, diaAtual]
    )
    const tasks = []
    for (const row of result.rows) {
      const chatIds = (row.chat_id || '').split(',').map(s => s.trim()).filter(Boolean)
      if (chatIds.length <= 1) {
        tasks.push(row)
      } else {
        for (const cid of chatIds) {
          tasks.push({ ...row, chat_id: cid })
        }
      }
    }
    console.log(`[n8n-tasks-get] Sucesso: ${result.rows.length} tarefas → ${tasks.length} envios`)
    return NextResponse.json({ tasks })
  } catch (e) {
    console.error('[n8n-tasks-get] Erro ao buscar tarefas:', e.message)
    return NextResponse.json({ tasks: [], error: e.message })
  }
}

export async function POST(request) {
  console.log('[n8n-tasks-post] Iniciando atualização de execução')
  if (!checkToken(request)) {
    console.warn('[n8n-tasks-post] Unauthorized: Token inválido')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Support both JSON body and query parameter
    let id = null
    const url = new URL(request.url)
    id = url.searchParams.get('id')

    if (!id) {
      try {
        const body = await request.json()
        id = body.id
      } catch (e) {}
    }

    if (!id) {
      console.warn('[n8n-tasks-post] Erro: ID obrigatório')
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
    }

    console.log(`[n8n-tasks-post] Marcando tarefa ${id} como executada`)
    await ensureTable()
    await query(
      'UPDATE dashboard_solicitacoes_programadas SET ultimo_executado = NOW() WHERE id = $1',
      [id]
    )
    console.log(`[n8n-tasks-post] Sucesso para ID ${id}`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[n8n-tasks-post] Erro ao atualizar tarefa:', e.message)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
