'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

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

export default function SystemPromptPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [originalPrompt, setOriginalPrompt] = useState('')
  const [defaultPrompt, setDefaultPrompt] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
        // Store default by fetching and then we compare later
        // We'll use the first load value when there's no saved data yet
        if (!defaultPrompt) setDefaultPrompt(data.prompt)
      }
    } catch (e) {
      showToast('Erro ao carregar prompt: ' + e.message, 'error')
    }
    setLoading(false)
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
      // Delete the saved prompt so the API returns the default
      const r = await fetch('/api/system-prompt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '__RESET_TO_DEFAULT__' }),
      })
      // Now reload
      await loadPrompt()
      showToast('Prompt resetado para o padrão.')
    } catch (e) {
      showToast('Erro ao resetar: ' + e.message, 'error')
    }
  }

  const lineCount = prompt.split('\n').length
  const charCount = prompt.length
  const hasChanges = prompt !== originalPrompt

  return (
    <div className="min-h-screen bg-[#0f0f13]">
      <Navbar user={user} />
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">⚙️ System Prompt</h1>
          <p className="text-gray-400 text-sm mt-1">
            Instruções base que o Maluco da IA segue em todas as respostas
          </p>
        </div>

        {/* Toast */}
        {toast.text && (
          <div className={`mb-4 text-sm px-4 py-2.5 rounded-lg border ${
            toast.type === 'error'
              ? 'bg-red-900/20 border-red-800 text-red-400'
              : 'bg-green-900/20 border-green-800 text-green-400'
          }`}>
            {toast.text}
          </div>
        )}

        {/* Placeholders reference */}
        <div className="bg-[#1a1a24] border border-gray-800 rounded-xl p-5 mb-6">
          <h2 className="text-white font-medium mb-3 text-sm">Placeholders disponíveis</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PLACEHOLDERS.map(({ key, desc }) => (
              <div key={key} className="flex items-start gap-2 text-sm">
                <code className="bg-[#0f0f13] border border-gray-700 text-blue-300 px-2 py-0.5 rounded font-mono text-xs shrink-0">
                  {key}
                </code>
                <span className="text-gray-400 text-xs mt-0.5">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="bg-[#1a1a24] border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
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
              className="w-full bg-[#0f0f13] text-gray-200 text-sm font-mono px-5 py-4 focus:outline-none resize-none"
              style={{ minHeight: '60vh' }}
              spellCheck={false}
              placeholder="Digite as instruções do system prompt aqui..."
            />
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800 bg-[#15151e]">
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
                className="text-sm bg-[#071DE3] hover:bg-[#0516B0] disabled:opacity-40 text-white px-5 py-2 rounded-lg transition font-medium"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
