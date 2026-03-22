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
