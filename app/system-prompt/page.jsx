'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { Settings } from 'lucide-react'

const PLACEHOLDERS = [
  { key: '{{DATA}}', desc: 'data atual (ex: 23/03/2026)' },
  { key: '{{ANO}}', desc: 'ano atual' },
  { key: '{{TODAY}}', desc: 'data ISO (ex: 2026-03-23)' },
  { key: '{{COLABORADORES}}', desc: 'lista de colaboradores cadastrados' },
  { key: '{{CLIENTES}}', desc: 'resultado da busca de clientes' },
  { key: '{{POPS}}', desc: 'procedimentos operacionais cadastrados' },
  { key: '{{HISTORICO}}', desc: 'últimas mensagens do grupo' },
  { key: '{{REGRAS}}', desc: 'regras de treinamento (injetadas automaticamente no início)' },
]

const RELATORIO_PLACEHOLDERS = [
  { key: '{PERIODO}', desc: 'período do relatório (ex: DE HOJE, SEMANAL, MENSAL)' },
  { key: '{DATA}', desc: 'data atual formatada' },
]

export default function SystemPromptPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)

  // System prompt state
  const [prompt, setPrompt] = useState('')
  const [originalPrompt, setOriginalPrompt] = useState('')
  const [defaultPrompt, setDefaultPrompt] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Relatório prompt state
  const [relatorioPrompt, setRelatorioPrompt] = useState('')
  const [originalRelatorioPrompt, setOriginalRelatorioPrompt] = useState('')
  const [relatorioIsDefault, setRelatorioIsDefault] = useState(true)
  const [loadingRelatorio, setLoadingRelatorio] = useState(true)
  const [savingRelatorio, setSavingRelatorio] = useState(false)

  const [toast, setToast] = useState({ text: '', type: '' })

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) { router.push('/login'); return null }
      return r.json()
    }).then(d => {
      if (!d) return
      if (d.role !== 'admin') { router.push('/dashboard'); return }
      setUser(d)
      loadPrompt()
      loadRelatorioPrompt()
    })
  }, [router])

  async function loadPrompt() {
    setLoading(true)
    try {
      const r = await fetch('/api/system-prompt')
      if (r.ok) {
        const data = await r.json()
        setPrompt(data.prompt)
        setOriginalPrompt(data.prompt)
        if (!defaultPrompt) setDefaultPrompt(data.prompt)
      }
    } catch (e) {
      showToast('Erro ao carregar prompt: ' + e.message, 'error')
    }
    setLoading(false)
  }

  async function loadRelatorioPrompt() {
    setLoadingRelatorio(true)
    try {
      const r = await fetch('/api/relatorio-prompt')
      if (r.ok) {
        const data = await r.json()
        setRelatorioPrompt(data.prompt)
        setOriginalRelatorioPrompt(data.prompt)
        setRelatorioIsDefault(data.isDefault)
      }
    } catch (e) {
      showToast('Erro ao carregar prompt de relatório: ' + e.message, 'error')
    }
    setLoadingRelatorio(false)
  }

  function showToast(text, type = 'success') {
    setToast({ text, type })
    setTimeout(() => setToast({ text: '', type: '' }), 4000)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const r = await fetch('/api/system-prompt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (r.ok) {
        setOriginalPrompt(prompt)
        showToast('System prompt salvo com sucesso!')
      } else {
        const d = await r.json().catch(() => ({}))
        showToast('Erro ao salvar: ' + (d.error || r.status), 'error')
      }
    } catch (e) {
      showToast('Erro ao salvar: ' + e.message, 'error')
    }
    setSaving(false)
  }

  async function handleReset() {
    if (!confirm('Tem certeza? Isso vai resetar o prompt para o valor padrão do sistema. O prompt atual será perdido se você não salvar.')) return
    try {
      await fetch('/api/system-prompt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '__RESET_TO_DEFAULT__' }),
      })
      await loadPrompt()
      showToast('Prompt resetado para o padrão.')
    } catch (e) {
      showToast('Erro ao resetar: ' + e.message, 'error')
    }
  }

  async function handleSaveRelatorio() {
    setSavingRelatorio(true)
    try {
      const r = await fetch('/api/relatorio-prompt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: relatorioPrompt }),
      })
      if (r.ok) {
        setOriginalRelatorioPrompt(relatorioPrompt)
        setRelatorioIsDefault(false)
        showToast('Prompt de relatório salvo com sucesso!')
      } else {
        const d = await r.json().catch(() => ({}))
        showToast('Erro ao salvar: ' + (d.error || r.status), 'error')
      }
    } catch (e) {
      showToast('Erro ao salvar: ' + e.message, 'error')
    }
    setSavingRelatorio(false)
  }

  async function handleResetRelatorio() {
    if (!confirm('Tem certeza? Isso vai resetar o prompt de relatório para o padrão embutido no sistema.')) return
    try {
      const r = await fetch('/api/relatorio-prompt', { method: 'DELETE' })
      if (r.ok) {
        await loadRelatorioPrompt()
        showToast('Prompt de relatório resetado para o padrão.')
      } else {
        const d = await r.json().catch(() => ({}))
        showToast('Erro ao resetar: ' + (d.error || r.status), 'error')
      }
    } catch (e) {
      showToast('Erro ao resetar: ' + e.message, 'error')
    }
  }

  const lineCount = prompt.split('\n').length
  const charCount = prompt.length
  const hasChanges = prompt !== originalPrompt

  const relatorioLineCount = relatorioPrompt.split('\n').length
  const relatorioCharCount = relatorioPrompt.length
  const hasRelatorioChanges = relatorioPrompt !== originalRelatorioPrompt

  return (
    <div className="min-h-screen bg-surface">
      <Navbar user={user} />
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Settings className="w-6 h-6 text-[#2E4EF0]" /> System Prompt</h1>
          <p className="text-gray-400 text-sm mt-1">
            Instruções base que o Maluco da IA segue em todas as respostas
          </p>
        </div>

        {/* Toast */}
        {toast.text && (
          <div className={`mb-4 text-sm px-4 py-2.5 rounded-lg border ${
            toast.type === 'error'
              ? 'bg-red-900/20 border-red-800 text-red-400'
              : 'bg-green-900/20 border-green-800 text-brand'
          }`}>
            {toast.text}
          </div>
        )}

        {/* Placeholders reference */}
        <div className="bg-surface-raised border border-white/[0.06] rounded-xl p-5 mb-6">
          <h2 className="text-white font-medium mb-3 text-sm">Placeholders disponíveis</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PLACEHOLDERS.map(({ key, desc }) => (
              <div key={key} className="flex items-start gap-2 text-sm">
                <code className="bg-surface border border-gray-700 text-brand-light px-2 py-0.5 rounded font-mono text-xs shrink-0">
                  {key}
                </code>
                <span className="text-gray-400 text-xs mt-0.5">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="bg-surface-raised border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
            <h2 className="text-white font-medium text-sm">Editor</h2>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{charCount.toLocaleString()} caracteres</span>
              <span>{lineCount} linhas</span>
              {hasChanges && <span className="text-yellow-400">● não salvo</span>}
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-gray-500">Carregando...</div>
          ) : (
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              className="w-full bg-surface text-gray-200 text-sm font-mono px-5 py-4 focus:outline-none resize-none"
              style={{ minHeight: '60vh' }}
              spellCheck={false}
              placeholder="Digite as instruções do system prompt aqui..."
            />
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06] bg-[#15151e]">
            <button
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-gray-300 transition"
            >
              Resetar para padrão
            </button>
            <div className="flex gap-3">
              {hasChanges && (
                <button
                  onClick={() => { setPrompt(originalPrompt) }}
                  className="text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition"
                >
                  Descartar
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="text-sm bg-brand hover:bg-brand-dark disabled:opacity-40 text-white px-5 py-2 rounded-lg transition font-medium"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>

        {/* Relatório prompt section */}
        <div className="mt-10 mb-6">
          <h2 className="text-xl font-bold text-white">Prompt de Relatório</h2>
          <p className="text-gray-400 text-sm mt-1">
            Instruções usadas pelo bot para gerar relatórios diários, semanais e mensais
            {relatorioIsDefault && <span className="ml-2 text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">padrão do sistema</span>}
          </p>
        </div>

        {/* Relatório placeholders */}
        <div className="bg-surface-raised border border-white/[0.06] rounded-xl p-5 mb-6">
          <h3 className="text-white font-medium mb-3 text-sm">Placeholders disponíveis no relatório</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {RELATORIO_PLACEHOLDERS.map(({ key, desc }) => (
              <div key={key} className="flex items-start gap-2 text-sm">
                <code className="bg-surface border border-gray-700 text-brand-light px-2 py-0.5 rounded font-mono text-xs shrink-0">
                  {key}
                </code>
                <span className="text-gray-400 text-xs mt-0.5">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Relatório Editor */}
        <div className="bg-surface-raised border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
            <h3 className="text-white font-medium text-sm">Editor de Relatório</h3>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{relatorioCharCount.toLocaleString()} caracteres</span>
              <span>{relatorioLineCount} linhas</span>
              {hasRelatorioChanges && <span className="text-yellow-400">● não salvo</span>}
            </div>
          </div>

          {loadingRelatorio ? (
            <div className="p-10 text-center text-gray-500">Carregando...</div>
          ) : (
            <textarea
              value={relatorioPrompt}
              onChange={e => setRelatorioPrompt(e.target.value)}
              className="w-full bg-surface text-gray-200 text-sm font-mono px-5 py-4 focus:outline-none resize-none"
              style={{ minHeight: '40vh' }}
              spellCheck={false}
              placeholder="Digite as instruções do prompt de relatório aqui..."
            />
          )}

          <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06] bg-[#15151e]">
            <button
              onClick={handleResetRelatorio}
              className="text-xs text-gray-500 hover:text-gray-300 transition"
            >
              Resetar para padrão
            </button>
            <div className="flex gap-3">
              {hasRelatorioChanges && (
                <button
                  onClick={() => { setRelatorioPrompt(originalRelatorioPrompt) }}
                  className="text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition"
                >
                  Descartar
                </button>
              )}
              <button
                onClick={handleSaveRelatorio}
                disabled={savingRelatorio || !hasRelatorioChanges}
                className="text-sm bg-brand hover:bg-brand-dark disabled:opacity-40 text-white px-5 py-2 rounded-lg transition font-medium"
              >
                {savingRelatorio ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
