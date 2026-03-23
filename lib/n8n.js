const N8N_URL = process.env.N8N_URL || 'http://localhost:5678'
const N8N_API_KEY = process.env.N8N_API_KEY

const headers = () => ({
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json',
})

export async function getWorkflow(id) {
  const res = await fetch(`${N8N_URL}/api/v1/workflows/${id}`, {
    headers: headers(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`N8N ${res.status}`)
  return res.json()
}

export async function getWorkflows() {
  const res = await fetch(`${N8N_URL}/api/v1/workflows?limit=250`, {
    headers: headers(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`N8N ${res.status}`)
  return res.json()
}

export async function getExecutions(workflowId, limit = 25) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (workflowId) params.set('workflowId', workflowId)
  const res = await fetch(`${N8N_URL}/api/v1/executions?${params}`, {
    headers: headers(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`N8N ${res.status}`)
  return res.json()
}

export async function getExecution(id) {
  const res = await fetch(`${N8N_URL}/api/v1/executions/${id}`, {
    headers: headers(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`N8N ${res.status}`)
  return res.json()
}

export async function duplicateWorkflow(baseWorkflowId, newName, webhookPath) {
  // 1. GET base workflow
  const base = await getWorkflow(baseWorkflowId)

  // 2. Build clean node list
  const allowedNodeFields = ['id', 'name', 'type', 'typeVersion', 'position', 'parameters', 'credentials', 'onError']
  const nodes = (base.nodes || []).map(node => {
    const clean = {}
    for (const key of allowedNodeFields) {
      if (key in node) clean[key] = node[key]
    }
    // Update webhook path if this is a webhook node
    if (
      (node.type === 'n8n-nodes-base.webhook' || node.type === 'n8n-nodes-base.Webhook') &&
      clean.parameters
    ) {
      clean.parameters = { ...clean.parameters, path: webhookPath }
    }
    return clean
  })

  // 3. Build clean settings
  const allowedSettingsFields = [
    'executionOrder', 'timezone', 'saveManualExecutions',
    'saveExecutionProgress', 'saveDataSuccessExecution',
    'saveDataErrorExecution', 'callerPolicy',
  ]
  const settings = {}
  if (base.settings) {
    for (const key of allowedSettingsFields) {
      if (key in base.settings) settings[key] = base.settings[key]
    }
  }

  // 4. Build body — strip id, versionId, meta, tags, createdAt, updatedAt, active
  const body = {
    name: newName,
    nodes,
    connections: base.connections || {},
    settings,
    staticData: base.staticData || null,
  }

  // 5. POST to create
  const createRes = await fetch(`${N8N_URL}/api/v1/workflows`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  if (!createRes.ok) {
    const errText = await createRes.text()
    throw new Error(`Falha ao criar workflow: ${createRes.status} - ${errText}`)
  }
  const created = await createRes.json()

  // 6. Activate
  try {
    const activateRes = await fetch(`${N8N_URL}/api/v1/workflows/${created.id}/activate`, {
      method: 'POST',
      headers: headers(),
    })
    if (!activateRes.ok) {
      console.warn(`Aviso: workflow criado mas não ativado (${activateRes.status})`)
    }
  } catch (err) {
    console.warn('Aviso: erro ao ativar workflow:', err.message)
  }

  return created
}
