'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

const TOTAL_STEPS = 4

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function maskKey(val) {
  if (!val || val.length <= 6) return val || ''
  return '...' + val.slice(-6)
}

export default function NovaFilialPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [workflows, setWorkflows] = useState([])
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)

  const [form, setForm] = useState({
    nome: '',
    webhook_path: '',
    evolution_url: '',
    evolution_apikey: '',
    evolution_instance: '',
    group_chat_id: '',
    anthropic_key: '',
    openai_key: '',
    notion_token: '',
    base_workflow_id: '',
  })

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) { router.push('/login'); return null }
      return r.json()
    }).then(d => {
      if (!d) return
      if (d.role !== 'admin') { router.push('/dashboard'); return }
      setUser(d)
    })
    fetch('/api/n8n/workflows').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.data) setWorkflows(d.data)
      else if (Array.isArray(d)) setWorkflows(d)
    }).catch(() => {})
  }, [router])

  function updateForm(key, value) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      // Auto-generate webhook_path from nome if user hasn't manually edited it
      if (key === 'nome' && !prev._webhookEdited) {
        next.webhook_path = slugify(value)
      }
      return next
    })
  }

  function handleWebhookEdit(value) {
    setForm(prev => ({ ...prev, webhook_path: value, _webhookEdited: true }))
  }

  const n8nUrl = typeof window !== 'undefined' ? '' : ''
  const webhookPreview = form.webhook_path
    ? `[N8N_URL]/webhook/${form.webhook_path}`
    : '[N8N_URL]/webhook/...'

  async function criarFilial() {
    setLoading(true)
    try {
      const payload = { ...form }
      delete payload._webhookEdited
      const r = await fetch('/api/filiais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Erro ao criar filial')
      setResult(data)
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  async function testarConexoes() {
    if (!result?.filial?.id) return
    setLoading(true)
    try {
      const r = await fetch(`/api/filiais/${result.filial.id}/test-connection`, { method: 'POST' })
      const data = await r.json()
      setResult(prev => ({ ...prev, testResult: data }))
    } catch (err) {
      setResult(prev => ({ ...prev, testResult: { error: err.message } }))
    } finally {
      setLoading(false)
    }
  }

  async function configurarBanco() {
    if (!result?.filial?.id) return
    setLoading(true)
    try {
      const r = await fetch(`/api/filiais/${result.filial.id}/setup-db`, { method: 'POST' })
      const data = await r.json()
      setResult(prev => ({ ...prev, dbResult: data }))
    } catch (err) {
      setResult(prev => ({ ...prev, dbResult: { error: err.message } }))
    } finally {
      setLoading(false)
    }
  }

  function copyWebhook() {
    if (result?.webhook_url) {
      navigator.clipboard.writeText(result.webhook_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const inputCls = 'w-full bg-[#0f0f13] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500'
  const labelCls = 'block text-xs text-gray-400 mb-1'

  const stepTitles = [
    'Informações básicas',
    'Configuração WhatsApp',
    'Chaves de API',
    'Revisão e criação',
  ]

  return (
    <div className="min-h-screen bg-[#0f0f13]">
      <Navbar user={user} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.push('/admin')}
            className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition"
          >
            ← Voltar
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Nova Filial</h1>
            <p className="text-gray-400 text-sm">Configure um novo bot para uma filial</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {stepTitles.map((title, i) => {
            const n = i + 1
            const active = n === step
            const done = n < step
            return (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition
                  ${done ? 'bg-green-600 text-white' : active ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-500'}`}>
                  {done ? '✓' : n}
                </div>
                <span className={`text-xs hidden sm:block ${active ? 'text-white' : 'text-gray-500'}`}>{title}</span>
                {i < TOTAL_STEPS - 1 && <div className={`h-px flex-1 ${done ? 'bg-green-700' : 'bg-gray-800'}`} />}
              </div>
            )
          })}
        </div>

        <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-6">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div>
              <h2 className="text-white font-semibold text-lg mb-5">Informações básicas</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Nome da filial *</label>
                  <input
                    className={inputCls}
                    value={form.nome}
                    onChange={e => updateForm('nome', e.target.value)}
                    placeholder="Ex: Lunardelli"
                  />
                </div>
                <div>
                  <label className={labelCls}>Slug do webhook (gerado automaticamente)</label>
                  <input
                    className={inputCls}
                    value={form.webhook_path}
                    onChange={e => handleWebhookEdit(e.target.value)}
                    placeholder="lunardelli"
                  />
                  {form.webhook_path && (
                    <p className="text-xs text-gray-500 mt-1">
                      Preview: <span className="text-purple-400">[N8N_URL]/webhook/{form.webhook_path}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div>
              <h2 className="text-white font-semibold text-lg mb-5">Configuração WhatsApp (Evolution API)</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>URL da Evolution API</label>
                  <input
                    className={inputCls}
                    value={form.evolution_url}
                    onChange={e => updateForm('evolution_url', e.target.value)}
                    placeholder="https://evolution.seudominio.com"
                  />
                </div>
                <div>
                  <label className={labelCls}>API Key da Evolution</label>
                  <input
                    className={inputCls}
                    type="password"
                    value={form.evolution_apikey}
                    onChange={e => updateForm('evolution_apikey', e.target.value)}
                    placeholder="sua-apikey-evolution"
                  />
                </div>
                <div>
                  <label className={labelCls}>Nome da instância</label>
                  <input
                    className={inputCls}
                    value={form.evolution_instance}
                    onChange={e => updateForm('evolution_instance', e.target.value)}
                    placeholder="ZazzClaude"
                  />
                </div>
                <div>
                  <label className={labelCls}>ID do grupo WhatsApp (chat_id)</label>
                  <input
                    className={inputCls}
                    value={form.group_chat_id}
                    onChange={e => updateForm('group_chat_id', e.target.value)}
                    placeholder="120363409735124488@g.us"
                  />
                </div>
              </div>
              {form.webhook_path && (
                <div className="mt-4 bg-blue-900/20 border border-blue-800 rounded-lg px-4 py-3 text-xs text-blue-300">
                  <strong>Importante:</strong> Após criar a filial, configure o webhook na Evolution API para a instância{' '}
                  <span className="font-mono">{form.evolution_instance || '(instância)'}</span> com a URL:{' '}
                  <span className="font-mono text-blue-200">[N8N_URL]/webhook/{form.webhook_path}</span>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div>
              <h2 className="text-white font-semibold text-lg mb-5">Chaves de API</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Anthropic API Key</label>
                  <input
                    className={inputCls}
                    type="password"
                    value={form.anthropic_key}
                    onChange={e => updateForm('anthropic_key', e.target.value)}
                    placeholder="Deixe vazio para usar a chave principal"
                  />
                </div>
                <div>
                  <label className={labelCls}>OpenAI API Key</label>
                  <input
                    className={inputCls}
                    type="password"
                    value={form.openai_key}
                    onChange={e => updateForm('openai_key', e.target.value)}
                    placeholder="Deixe vazio para usar a chave principal"
                  />
                </div>
                <div>
                  <label className={labelCls}>Notion Token (opcional)</label>
                  <input
                    className={inputCls}
                    type="password"
                    value={form.notion_token}
                    onChange={e => updateForm('notion_token', e.target.value)}
                    placeholder="Deixe vazio para usar o token principal"
                  />
                </div>
                <div>
                  <label className={labelCls}>Workflow base para duplicar</label>
                  {workflows.length > 0 ? (
                    <select
                      className={inputCls}
                      value={form.base_workflow_id}
                      onChange={e => updateForm('base_workflow_id', e.target.value)}
                    >
                      <option value="">-- Nenhum (criar sem workflow) --</option>
                      {workflows.map(wf => (
                        <option key={wf.id} value={wf.id}>{wf.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={inputCls}
                      value={form.base_workflow_id}
                      onChange={e => updateForm('base_workflow_id', e.target.value)}
                      placeholder="ID do workflow base (ex: BhIJ7UrKM9uWhXHa)"
                    />
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Um novo workflow será criado como cópia deste, com o webhook configurado automaticamente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4 ── */}
          {step === 4 && !result && (
            <div>
              <h2 className="text-white font-semibold text-lg mb-5">Revisão e criação</h2>
              <div className="space-y-3 text-sm">
                <div className="bg-[#0f0f13] rounded-lg p-4 space-y-2">
                  <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-3">Informações básicas</h3>
                  <Row label="Nome" value={form.nome} />
                  <Row label="Webhook path" value={form.webhook_path} mono />
                  <Row label="Webhook URL" value={`[N8N_URL]/webhook/${form.webhook_path}`} mono />
                </div>
                <div className="bg-[#0f0f13] rounded-lg p-4 space-y-2">
                  <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-3">Evolution API</h3>
                  <Row label="URL" value={form.evolution_url || '—'} />
                  <Row label="API Key" value={form.evolution_apikey ? maskKey(form.evolution_apikey) : '—'} mono />
                  <Row label="Instância" value={form.evolution_instance || '—'} />
                  <Row label="Group chat_id" value={form.group_chat_id || '—'} mono />
                </div>
                <div className="bg-[#0f0f13] rounded-lg p-4 space-y-2">
                  <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-3">Chaves de API</h3>
                  <Row label="Anthropic" value={form.anthropic_key ? maskKey(form.anthropic_key) : '(usar principal)'} mono />
                  <Row label="OpenAI" value={form.openai_key ? maskKey(form.openai_key) : '(usar principal)'} mono />
                  <Row label="Notion" value={form.notion_token ? maskKey(form.notion_token) : '(usar principal)'} mono />
                  <Row label="Workflow base" value={form.base_workflow_id || '(nenhum)'} />
                </div>
              </div>
              <button
                onClick={criarFilial}
                disabled={loading || !form.nome}
                className="mt-6 w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition"
              >
                {loading ? 'Criando...' : 'Criar Filial'}
              </button>
            </div>
          )}

          {/* ── RESULT ── */}
          {step === 4 && result && (
            <div>
              <h2 className="text-white font-semibold text-lg mb-5">Resultado</h2>

              {result.error ? (
                <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm mb-4">
                  Erro: {result.error}
                </div>
              ) : (
                <div className="space-y-3">
                  <StatusItem ok label="Filial criada" detail={`ID: ${result.filial?.id}`} />
                  <StatusItem
                    ok={result.workflow_duplicated}
                    label="Workflow duplicado"
                    detail={result.workflow_duplicated ? `ID: ${result.workflow_id}` : (result.workflow_error || 'Não configurado')}
                  />

                  {/* Webhook URL */}
                  {result.webhook_url && (
                    <div className="bg-[#0f0f13] rounded-lg p-4">
                      <p className="text-gray-400 text-xs mb-2">URL do Webhook</p>
                      <div className="flex items-center gap-2">
                        <code className="text-purple-400 text-sm flex-1 break-all">{result.webhook_url}</code>
                        <button
                          onClick={copyWebhook}
                          className="shrink-0 bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded transition"
                        >
                          {copied ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Instructions */}
                  {form.evolution_instance && result.webhook_url && (
                    <div className="bg-blue-900/20 border border-blue-800 rounded-lg px-4 py-3 text-xs text-blue-300">
                      Configure esse webhook na Evolution API para a instância{' '}
                      <strong>{form.evolution_instance}</strong>.
                    </div>
                  )}

                  {/* Test results */}
                  {result.testResult && (
                    <div className="bg-[#0f0f13] rounded-lg p-4 space-y-2">
                      <p className="text-gray-400 text-xs mb-2">Resultado dos testes</p>
                      {Object.entries(result.testResult.results || {}).map(([key, val]) => (
                        <StatusItem key={key} ok={val.ok} label={key} detail={val.message} />
                      ))}
                      {result.testResult.error && (
                        <p className="text-red-400 text-xs">{result.testResult.error}</p>
                      )}
                    </div>
                  )}

                  {/* DB results */}
                  {result.dbResult && (
                    <div className="bg-[#0f0f13] rounded-lg p-4 space-y-2">
                      <p className="text-gray-400 text-xs mb-2">Configuração do banco</p>
                      {Object.entries(result.dbResult.results || {}).map(([key, val]) => (
                        <StatusItem key={key} ok={val.ok} label={key} detail={val.message} />
                      ))}
                      {result.dbResult.error && (
                        <p className="text-red-400 text-xs">{result.dbResult.error}</p>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-3 mt-2">
                    <button
                      onClick={testarConexoes}
                      disabled={loading}
                      className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition"
                    >
                      {loading ? 'Testando...' : 'Testar Conexões'}
                    </button>
                    <button
                      onClick={configurarBanco}
                      disabled={loading}
                      className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition"
                    >
                      Configurar Banco de Dados
                    </button>
                    <button
                      onClick={() => router.push(`/admin/filiais/${result.filial?.id}`)}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition"
                    >
                      Ver Detalhes
                    </button>
                    <button
                      onClick={() => router.push('/admin')}
                      className="text-gray-400 hover:text-white text-sm px-4 py-2 rounded-lg transition"
                    >
                      Voltar ao Admin
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          {!(step === 4 && result) && (
            <div className="flex justify-between mt-6">
              <button
                onClick={() => step > 1 ? setStep(s => s - 1) : router.push('/admin')}
                className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-5 py-2 rounded-lg transition"
              >
                {step === 1 ? 'Cancelar' : 'Anterior'}
              </button>
              {step < TOTAL_STEPS && (
                <button
                  onClick={() => setStep(s => s + 1)}
                  disabled={step === 1 && !form.nome}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg transition"
                >
                  Próximo
                </button>
              )}
            </div>
          )}
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

function StatusItem({ ok, label, detail }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="shrink-0 mt-0.5">{ok ? '✅' : '❌'}</span>
      <div>
        <span className={ok ? 'text-green-400' : 'text-red-400'}>{label}</span>
        {detail && <span className="text-gray-500 text-xs ml-2">{detail}</span>}
      </div>
    </div>
  )
}
