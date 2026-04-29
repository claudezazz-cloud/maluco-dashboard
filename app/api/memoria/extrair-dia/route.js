import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'

const N8N_URL = process.env.N8N_URL || 'https://n8n.srv1537041.hstgr.cloud'
const N8N_API_KEY = process.env.N8N_API_KEY || ''

// ID do workflow preenchido pelo create_workflow_memoria_dia.py após criação
const WORKFLOW_ID = process.env.N8N_MEMORIA_DIA_WF_ID || ''

export async function POST(request) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  if (!WORKFLOW_ID) {
    return NextResponse.json({ error: 'N8N_MEMORIA_DIA_WF_ID não configurado' }, { status: 503 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const r = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}/run`, {
      method: 'POST',
      headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startNodes: [], runData: {}, pinData: {}, workflowData: {} }),
    })

    if (!r.ok) {
      const err = await r.text()
      return NextResponse.json({ error: `N8N retornou ${r.status}: ${err.substring(0, 200)}` }, { status: 502 })
    }

    const data = await r.json()
    console.log('[memoria/extrair-dia] disparado:', data?.executionId || 'ok')
    return NextResponse.json({ triggered: true, executionId: data?.executionId })
  } catch (e) {
    console.error('[memoria/extrair-dia]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
