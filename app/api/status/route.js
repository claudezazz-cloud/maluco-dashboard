import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query } from '@/lib/db'
import { execFileSync } from 'child_process'

// Estado do n8n lido DIRETO do SQLite (o dashboard roda como root e o arquivo é world-readable).
// Assim NÃO dependemos da N8N_API_KEY, que expira a cada ~3 meses e derrubava o card "online".
const N8N_SQLITE = process.env.N8N_SQLITE_PATH || '/var/lib/docker/volumes/n8n_data/_data/database.sqlite'
const N8N_STATE_PY = `
import sqlite3, json, sys
wf = sys.argv[1]
try:
    c = sqlite3.connect('file:' + sys.argv[2] + '?mode=ro', uri=True, timeout=5)
    a = c.execute("SELECT active, name FROM workflow_entity WHERE id=?", (wf,)).fetchone()
    e = c.execute("SELECT id, status, startedAt, stoppedAt FROM execution_entity WHERE workflowId=? ORDER BY id DESC LIMIT 1", (wf,)).fetchone()
    c.close()
    print(json.dumps({"active": bool(a[0]) if a else False, "name": (a[1] if a else None), "exec": ({"id": e[0], "status": e[1], "startedAt": e[2], "stoppedAt": e[3]} if e else None)}))
except Exception as ex:
    print(json.dumps({"error": str(ex)}))
`
function n8nStateFromDb(workflowId) {
  try {
    const out = execFileSync('python3', ['-c', N8N_STATE_PY, workflowId, N8N_SQLITE], { timeout: 6000 }).toString()
    const d = JSON.parse(out)
    return d.error ? null : d
  } catch { return null }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    const filiaisResult = await query('SELECT * FROM dashboard_filiais WHERE ativo = true ORDER BY nome')
    const filiais = filiaisResult.rows
    const primeiraFilialId = filiais[0]?.id

    const results = await Promise.all(filiais.map(async (filial) => {
      let workflow = null
      let lastExecution = null
      let stateActive = null
      if (filial.n8n_workflow_id) {
        const st = n8nStateFromDb(filial.n8n_workflow_id)
        if (st) {
          stateActive = st.active
          if (st.name) workflow = { name: st.name, active: st.active }
          lastExecution = st.exec || null
        }
      }

      // Respostas do Claude hoje (timezone America/Sao_Paulo).
      // NOTA: o bot atende VÁRIOS grupos sob uma só filial, então contamos TODAS as
      // interações do dia (não filtra por group_chat_id, que era um valor único e
      // desatualizado — causava "0" mesmo com movimento). Não depende da API do n8n.
      let mensagensHoje = 0
      try {
        const r = await query(`
          SELECT COUNT(*)::int AS total FROM bot_conversas
          WHERE (criado_em AT TIME ZONE 'America/Sao_Paulo')::date
              = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
        `)
        mensagensHoje = r.rows[0]?.total || 0
      } catch {}

      // Erros hoje — bot_erros (Postgres, populada pelo próprio workflow). Todos os grupos.
      let errosHoje = 0
      try {
        const r = await query(`
          SELECT COUNT(*)::int AS total FROM bot_erros
          WHERE (criado_em AT TIME ZONE 'America/Sao_Paulo')::date
              = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
        `)
        errosHoje = r.rows[0]?.total || 0
      } catch {}

      // Online: estado REAL do workflow (lido do SQLite do n8n). Se não conseguiu ler,
      // cai pra heurística de atividade recente (últimos 40min).
      let online
      if (stateActive !== null) {
        online = stateActive === true
      } else {
        online = false
        try {
          const r = await query(`
            SELECT 1 WHERE
              EXISTS (SELECT 1 FROM bot_conversas WHERE criado_em >= NOW() - INTERVAL '40 minutes')
              OR EXISTS (SELECT 1 FROM mensagens WHERE data_hora >= NOW() - INTERVAL '40 minutes')
          `)
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
