'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [filiais, setFiliais] = useState([])
  const [tab, setTab] = useState('filiais')
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({})
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) { router.push('/login'); return null }
      return r.json()
    }).then(d => {
      if (!d) return
      if (d.role !== 'admin') { router.push('/dashboard'); return }
      setUser(d)
    })
    fetchFiliais()
  }, [router])

  async function fetchFiliais() {
    const r = await fetch('/api/filiais')
    if (r.ok) setFiliais(await r.json())
  }

  function iniciarEdicao(filial) {
    setEditando(filial?.id || 'novo')
    setForm(filial || { nome: '', n8n_workflow_id: '', evolution_instance: '', group_chat_id: '', ativo: true })
    setMsg('')
  }

  async function salvarFilial() {
    const isNovo = editando === 'novo'
    const url = isNovo ? '/api/filiais' : `/api/filiais/${editando}`
    const method = isNovo ? 'POST' : 'PUT'

    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (r.ok) {
      setMsg('Salvo com sucesso!')
      setEditando(null)
      fetchFiliais()
    } else {
      setMsg('Erro ao salvar')
    }
  }

  async function excluirFilial(id) {
    if (!confirm('Desativar esta filial?')) return
    await fetch(`/api/filiais/${id}`, { method: 'DELETE' })
    fetchFiliais()
  }

  const inputCls = 'w-full bg-[#0f0f13] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500'
  const labelCls = 'block text-xs text-gray-400 mb-1'

  return (
    <div className="min-h-screen bg-[#0f0f13]">
      <Navbar user={user} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">Administração</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#1a1a24] rounded-lg p-1 w-fit">
          {['filiais'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition capitalize ${tab === t ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {t === 'filiais' ? 'Filiais' : t}
            </button>
          ))}
        </div>

        {/* Filiais */}
        {tab === 'filiais' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-gray-300 font-medium">Filiais cadastradas</h2>
              <button onClick={() => iniciarEdicao(null)} className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition">
                + Nova Filial
              </button>
            </div>

            {msg && <div className="mb-4 text-sm text-green-400 bg-green-900/20 border border-green-800 rounded-lg px-4 py-2">{msg}</div>}

            {/* Form edição */}
            {editando && (
              <div className="bg-[#1a1a24] rounded-xl border border-purple-800 p-6 mb-6">
                <h3 className="text-white font-medium mb-4">{editando === 'novo' ? 'Nova Filial' : 'Editar Filial'}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Nome da filial *</label>
                    <input className={inputCls} value={form.nome || ''} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Lunardelli" />
                  </div>
                  <div>
                    <label className={labelCls}>ID do Workflow N8N</label>
                    <input className={inputCls} value={form.n8n_workflow_id || ''} onChange={e => setForm({...form, n8n_workflow_id: e.target.value})} placeholder="BhIJ7UrKM9uWhXHa" />
                  </div>
                  <div>
                    <label className={labelCls}>Instância Evolution API</label>
                    <input className={inputCls} value={form.evolution_instance || ''} onChange={e => setForm({...form, evolution_instance: e.target.value})} placeholder="ZazzClaude" />
                  </div>
                  <div>
                    <label className={labelCls}>Chat ID do grupo WhatsApp</label>
                    <input className={inputCls} value={form.group_chat_id || ''} onChange={e => setForm({...form, group_chat_id: e.target.value})} placeholder="120363409735124488@g.us" />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={salvarFilial} className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-5 py-2 rounded-lg transition">Salvar</button>
                  <button onClick={() => setEditando(null)} className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-5 py-2 rounded-lg transition">Cancelar</button>
                </div>
              </div>
            )}

            {/* Lista */}
            <div className="space-y-3">
              {filiais.map(f => (
                <div key={f.id} className="bg-[#1a1a24] rounded-xl border border-gray-800 px-5 py-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{f.nome}</span>
                      {!f.ativo && <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">Inativo</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 space-x-3">
                      <span>Workflow: {f.n8n_workflow_id || '—'}</span>
                      <span>Evolution: {f.evolution_instance || '—'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => iniciarEdicao(f)} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition">Editar</button>
                    <button onClick={() => excluirFilial(f.id)} className="text-xs bg-red-900/40 hover:bg-red-800 text-red-400 px-3 py-1.5 rounded-lg transition">Remover</button>
                  </div>
                </div>
              ))}
              {filiais.length === 0 && <p className="text-gray-500 text-sm">Nenhuma filial cadastrada.</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
