'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Navbar from '@/components/Navbar'

function maskKey(val) {
  if (!val || val.length <= 6) return val || '—'
  return '...' + val.slice(-6)
}

export default function FilialDetailPage() {
  const router = useRouter()
  const { id } = useParams()
  const [user, setUser] = useState(null)
  const [filial, setFilial] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [dbResult, setDbResult] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({})
  const [saveMsg, setSaveMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [workflows, setWorkflows] = useState([])

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) { router.push('/login'); return null }
      return r.json()
    }).then(d => {
      if (!d) return
      if (d.role !== 'admin') { router.push('/dashboard'); return }
      setUser(d)
    })
    fetchFilial()
    fetch('/api/n8n/workflows').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.data) setWorkflows(d.data)
      else if (Array.isArray(d)) setWorkflows(d)
    }).catch(() => {})
  }, [id, router])

  async function fetchFilial() {
    setLoading(true)
    try {
      const r = await fetch(`/api/filiais/${id}`)
      if (!r.ok) { router.push('/admin'); return }
      const data = await r.json()
      setFilial(data)
      setForm({
        nome: data.nome,
        n8n_workflow_id: data.n8n_workflow_id || '',
        evolution_instance: data.evolution_instance || '',
        group_chat_id: data.group_chat_id || '',
        ativo: data.ativo,
        evolution_url: data.config?.evolution_url || '',
        evolution_apikey: '',
        anthropic_key: '',
        openai_key: '',
        notion_token: '',
        webhook_path: data.config?.webhook_path || '',
      })
    } finally {
      setLoading(false)
    }
  }

  async function salvar() {
    setActionLoading(true)
    setSaveMsg('')
    try {
      const r = await fetch(`/api/filiais/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (r.ok) {
        setSaveMsg('Salvo com sucesso!')
        setEditMode(false)
        fetchFilial()
      } else {
        const d = await r.json()
        setSaveMsg(`Erro: ${d.error}`)
      }
    } finally {
      setActionLoading(false)
    }
  }

  async function testarConexoes() {
    setActionLoading(true)
    setTestResult(null)
    try {
      const r = await fetch(`/api/filiais/${id}/test-connection`, { method: 'POST' })
      setTestResult(await r.json())
    } catch (err) {
      setTestResult({ error: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  async function configurarBanco() {
    setActionLoading(true)
    setDbResult(null)
    try {
      const r = await fetch(`/api/filiais/${id}/setup-db`, { method: 'POST' })
      setDbResult(await r.json())
    } catch (err) {
      setDbResult({ error: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  async function reativarWorkflow() {
    if (!filial?.n8n_workflow_id) {
      alert('Nenhum workflow configurado.')
      return
    }
    setActionLoading(true)
    try {
      const r = await fetch(`/api/n8n/workflows/${filial.n8n_workflow_id}/activate`, { method: 'POST' })
      if (r.ok) {
        alert('Workflow reativado com sucesso!')
        fetchFilial()
      } else {
        const d = await r.json()
        alert(`Erro: ${d.error || r.status}`)
      }
    } catch (err) {
      alert(`Erro: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  async function duplicarWorkflow() {
    const baseId = prompt('ID do workflow base para duplicar:')
    if (!baseId) return
    setActionLoading(true)
    try {
      const r = await fetch(`/api/filiais/${id}/duplicate-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_workflow_id: baseId }),
      })
      const data = await r.json()
      if (r.ok) {
        alert(`Workflow criado com sucesso! ID: ${data.workflow_id}`)
        fetchFilial()
      } else {
        alert(`Erro: ${data.error}`)
      }
    } finally {
      setActionLoading(false)
    }
  }

  function copyWebhook() {
    const webhookUrl = getWebhookUrl()
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function getWebhookUrl() {
    const path = filial?.config?.webhook_path
    if (!path) return null
    return `${process.env.NEXT_PUBLIC_N8N_URL || '[N8N_URL]'}/webhook/${path}`
  }

  const inputCls = 'w-full bg-[#0f0f13] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#071DE3]'
  const labelCls = 'block text-xs text-gray-400 mb-1'

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f13]">
        <Navbar user={user} />
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!filial) return null

  const webhookUrl = getWebhookUrl()
  const cfg = filial.config || {}

  return (
    <div className="min-h-screen bg-[#0f0f13]">
      <Navbar user={user} />
      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin')}
              className="text-gray-400 hover:text-white text-sm transition"
            >
              ← Voltar
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">{filial.nome}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded ${filial.ativo ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                  {filial.ativo ? 'Ativa' : 'Inativa'}
                </span>
                {filial.n8n_workflow_id && (
                  <span className="text-xs text-gray-500">Workflow: {filial.n8n_workflow_id}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => { setEditMode(!editMode); setSaveMsg('') }}
            className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition"
          >
            {editMode ? 'Cancelar edição' : 'Editar config'}
          </button>
        </div>

        {saveMsg && (
          <div className={`mb-4 text-sm px-4 py-2 rounded-lg border ${saveMsg.startsWith('Erro') ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-green-900/20 border-green-800 text-green-400'}`}>
            {saveMsg}
          </div>
        )}

        {/* Edit form */}
        {editMode && (
          <div className="bg-[#1a1a24] rounded-xl border border-blue-900 p-6 mb-6">
            <h2 className="text-white font-semibold mb-4">Editar configuração</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Nome da filial</label>
                <input className={inputCls} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Webhook path</label>
                <input className={inputCls} value={form.webhook_path} onChange={e => setForm({ ...form, webhook_path: e.target.value })} placeholder="slug-da-filial" />
              </div>
              <div>
                <label className={labelCls}>URL Evolution API</label>
                <input className={inputCls} value={form.evolution_url} onChange={e => setForm({ ...form, evolution_url: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>API Key Evolution (deixe vazio para manter)</label>
                <input className={inputCls} type="password" value={form.evolution_apikey} onChange={e => setForm({ ...form, evolution_apikey: e.target.value })} placeholder="••••••••" />
              </div>
              <div>
                <label className={labelCls}>Instância Evolution</label>
                <input className={inputCls} value={form.evolution_instance} onChange={e => setForm({ ...form, evolution_instance: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Group chat_id</label>
                <input className={inputCls} value={form.group_chat_id} onChange={e => setForm({ ...form, group_chat_id: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>ID Workflow N8N</label>
                <input className={inputCls} value={form.n8n_workflow_id} onChange={e => setForm({ ...form, n8n_workflow_id: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Anthropic API Key (deixe vazio para manter)</label>
                <input className={inputCls} type="password" value={form.anthropic_key} onChange={e => setForm({ ...form, anthropic_key: e.target.value })} placeholder="Deixe vazio para usar a chave principal" />
              </div>
              <div>
                <label className={labelCls}>OpenAI API Key (deixe vazio para manter)</label>
                <input className={inputCls} type="password" value={form.openai_key} onChange={e => setForm({ ...form, openai_key: e.target.value })} placeholder="Deixe vazio para usar a chave principal" />
              </div>
              <div>
                <label className={labelCls}>Notion Token (deixe vazio para manter)</label>
                <input className={inputCls} type="password" value={form.notion_token} onChange={e => setForm({ ...form, notion_token: e.target.value })} placeholder="Deixe vazio para usar o token principal" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={salvar} disabled={actionLoading} className="bg-[#071DE3] hover:bg-[#0516B0] disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg transition">
                {actionLoading ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setEditMode(false)} className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-5 py-2 rounded-lg transition">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">

          {/* Webhook URL */}
          <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-5">
            <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-3">URL do Webhook</h3>
            {webhookUrl ? (
              <div className="flex items-center gap-2">
                <code className="text-blue-400 text-sm flex-1 break-all">{webhookUrl}</code>
                <button
                  onClick={copyWebhook}
                  className="shrink-0 bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded transition"
                >
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Webhook path não configurado</p>
            )}
          </div>

          {/* Evolution API config */}
          <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-5">
            <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-3">Evolution API</h3>
            <div className="space-y-2 text-sm">
              <Row label="URL" value={cfg.evolution_url || '—'} />
              <Row label="API Key" value={cfg.evolution_apikey ? maskKey(cfg.evolution_apikey) : '—'} mono />
              <Row label="Instância" value={filial.evolution_instance || cfg.evolution_instance || '—'} />
              <Row label="Group chat_id" value={filial.group_chat_id || '—'} mono />
            </div>
          </div>

          {/* API Keys */}
          <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-5">
            <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-3">Chaves de API</h3>
            <div className="space-y-2 text-sm">
              <Row label="Anthropic" value={cfg.anthropic_key ? maskKey(cfg.anthropic_key) : '(usando chave principal)'} mono />
              <Row label="OpenAI" value={cfg.openai_key ? maskKey(cfg.openai_key) : '(usando chave principal)'} mono />
              <Row label="Notion" value={cfg.notion_token ? maskKey(cfg.notion_token) : '(usando token principal)'} mono />
            </div>
          </div>

          {/* Status checklist */}
          <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-5">
            <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-3">Status</h3>
            {testResult ? (
              <div className="space-y-2">
                {Object.entries(testResult.results || {}).map(([key, val]) => (
                  <CheckItem key={key} ok={val.ok} label={formatTestKey(key)} detail={val.message} />
                ))}
                {testResult.error && <p className="text-red-400 text-xs mt-2">{testResult.error}</p>}
              </div>
            ) : (
              <div className="space-y-2">
                <CheckItem ok={!!filial.n8n_workflow_id} label="Workflow configurado no N8N" detail={filial.n8n_workflow_id || 'Não configurado'} />
                <CheckItem ok={!!(filial.evolution_instance || cfg.evolution_instance)} label="Evolution API configurada" />
                <CheckItem ok={!!webhookUrl} label="Webhook configurado" />
                <CheckItem ok label="Banco de dados" detail="Verificar clicando abaixo" />
              </div>
            )}
          </div>

          {/* DB result */}
          {dbResult && (
            <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-5">
              <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-3">Configuração do Banco</h3>
              <div className="space-y-2">
                {Object.entries(dbResult.results || {}).map(([key, val]) => (
                  <CheckItem key={key} ok={val.ok} label={key} detail={val.message} />
                ))}
                {dbResult.error && <p className="text-red-400 text-xs">{dbResult.error}</p>}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-5">
            <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-3">Ações</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={testarConexoes}
                disabled={actionLoading}
                className="bg-[#071DE3] hover:bg-[#0516B0] disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition"
              >
                {actionLoading ? 'Aguarde...' : 'Testar todas as conexões'}
              </button>
              <button
                onClick={configurarBanco}
                disabled={actionLoading}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition"
              >
                Verificar banco de dados
              </button>
              <button
                onClick={reativarWorkflow}
                disabled={actionLoading || !filial.n8n_workflow_id}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition"
              >
                Reativar workflow
              </button>
              <button
                onClick={duplicarWorkflow}
                disabled={actionLoading}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition"
              >
                Duplicar workflow
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-white text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}

function CheckItem({ ok, label, detail }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="shrink-0 mt-0.5 text-base">{ok ? '✅' : '⬜'}</span>
      <div>
        <span className={ok ? 'text-white' : 'text-gray-400'}>{label}</span>
        {detail && <span className="text-gray-500 text-xs ml-2">{detail}</span>}
      </div>
    </div>
  )
}

function formatTestKey(key) {
  const map = {
    n8n_workflow: 'Workflow ativo no N8N',
    evolution_api: 'Evolution API conectada',
    anthropic: 'Chave Anthropic',
    openai: 'Chave OpenAI',
    database: 'Banco de dados',
  }
  return map[key] || key
}
