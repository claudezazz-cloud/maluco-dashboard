import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query } from '@/lib/db'
import { execFileSync } from 'child_process'

// Execuções lidas DIRETO do SQLite do n8n (sem depender da N8N_API_KEY, que expira).
const N8N_SQLITE = process.env.N8N_SQLITE_PATH || '/var/lib/docker/volumes/n8n_data/_data/database.sqlite'
const EXECS_PY = `
import sqlite3, json, sys
wf = sys.argv[1]; lim = int(sys.argv[3])
try:
    c = sqlite3.connect('file:' + sys.argv[2] + '?mode=ro', uri=True, timeout=5)
    if wf:
        rows = c.execute("SELECT id,status,startedAt,stoppedAt,mode FROM execution_entity WHERE workflowId=? ORDER BY id DESC LIMIT ?", (wf, lim)).fetchall()
    else:
        rows = c.execute("SELECT id,status,startedAt,stoppedAt,mode FROM execution_entity ORDER BY id DESC LIMIT ?", (lim,)).fetchall()
    c.close()
    print(json.dumps([{"id": r[0], "status": r[1], "startedAt": r[2], "stoppedAt": r[3], "mode": r[4]} for r in rows]))
except Exception as ex:
    print(json.dumps({"error": str(ex)}))
`
function execsFromDb(workflowId, limit) {
  try {
    const out = execFileSync('python3', ['-c', EXECS_PY, workflowId || '', N8N_SQLITE, String(limit)], { timeout: 6000 }).toString()
    const d = JSON.parse(out)
    return Array.isArray(d) ? d : []
  } catch { return [] }
}

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

    const rows = execsFromDb(workflowId, 30)
    const executions = rows.map(e => ({
      id: e.id,
      status: e.status,
      inicio: e.startedAt,
      fim: e.stoppedAt,
      duracao: e.stoppedAt && e.startedAt
        ? Math.round((new Date(e.stoppedAt) - new Date(e.startedAt)) / 1000)
        : null,
      modo: e.mode,
    }))

    return NextResponse.json(executions)
  } catch (e) {
    console.error('executions error:', e?.message || e)
    return NextResponse.json([])
  }
}
