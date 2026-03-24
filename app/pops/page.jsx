'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

const CATEGORIAS = ['Geral', 'Atendimento', 'Técnico', 'Financeiro', 'Comercial', 'RH', 'Outro']

export default function PopsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [pops, setPops] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [editandoId, setEditandoId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [novoForm, setNovoForm] = useState({ titulo: '', categoria: 'Geral', conteudo: '' })
  const [mostraNovo, setMostraNovo] = useState(false)
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas')
  const [msg, setMsg] = useState({ texto: '', tipo: '' })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) { router.push('/login'); return null }
      return r.json()
    }).then(d => {
      if (!d) return
      if (d.role !== 'admin') { router.push('/dashboard'); return }
      setUser(d)
    })
    fetchPops()
  }, [router])

  async function fetchPops() {
    setLoading(true)
    const r = await fetch('/api/pops')
    if (r.ok) setPops(await r.json())
    setLoading(false)
  }

  function showMsg(texto, tipo = 'success') {
    setMsg({ texto, tipo })
    setTimeout(() => setMsg({ texto: '', tipo: '' }), 3000)
  }

  async function salvarNovo() {
    if (!novoForm.titulo.trim() || !novoForm.conteudo.trim()) return
    setSalvando(true)
    const r = await fetch('/api/pops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoForm),
    })
    setSalvando(false)
    if (r.ok) {
      setNovoForm({ titulo: '', categoria: 'Geral', conteudo: '' })
      setMostraNovo(false)
      showMsg('POP adicionado com sucesso!')
      fetchPops()
    } else {
      const d = await r.json().catch(() => ({}))
      showMsg('Erro: ' + (d.error || r.status), 'error')
    }
  }

  async function salvarEdicao() {
    setSalvando(true)
    const r = await fetch(`/api/pops/${editandoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setSalvando(false)
    if (r.ok) {
      setEditandoId(null)
      showMsg('POP atualizado!')
      fetchPops()
    } else {
      showMsg('Erro ao salvar', 'error')
    }
  }

  async function excluir(id, titulo) {
    if (!confirm(`Arquivar "${titulo}"?`)) return
    await fetch(`/api/pops/${id}`, { method: 'DELETE' })
    showMsg('POP arquivado.')
    fetchPops()
  }

  function iniciarEdicao(pop) {
    setEditandoId(pop.id)
    setEditForm({ titulo: pop.titulo, categoria: pop.categoria, conteudo: pop.conteudo })
    setExpandido(pop.id)
  }

  const categorias = ['Todas', ...new Set(pops.map(p => p.categoria).filter(Boolean))]
  const popsFiltrados = pops.filter(p => {
    const matchBusca = !busca || p.titulo.toLowerCase().includes(busca.toLowerCase()) || p.conteudo.toLowerCase().includes(busca.toLowerCase())
    const matchCat = categoriaFiltro === 'Todas' || p.categoria === categoriaFiltro
    return matchBusca && matchCat
  })

  const inputCls = 'w-full bg-[#0f0f13] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#071DE3] transition'
  const inputEditCls = 'w-full bg-[#0f0f13] border border-[#071DE3] rounded-lg px-3 py-2 text-white text-sm focus:outline-none transition'

  return (
    <div className="min-h-screen bg-[#0f0f13]">
      <Navbar user={user} />
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">POPs 📋</h1>
            <p className="text-gray-400 text-sm mt-1">Procedimentos Operacionais Padrão da empresa</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-blue-900/40 text-blue-300 border border-blue-900 text-sm px-3 py-1 rounded-full">
              {pops.length} {pops.length === 1 ? 'POP' : 'POPs'}
            </span>
            <button
              onClick={() => { setMostraNovo(true); setExpandido(null); setEditandoId(null) }}
              className="bg-[#071DE3] hover:bg-[#0516B0] text-white text-sm px-4 py-2 rounded-lg transition font-medium"
            >
              + Novo POP
            </button>
          </div>
        </div>

        {msg.texto && (
          <div className={`mb-4 text-sm px-4 py-2.5 rounded-lg border ${msg.tipo === 'error' ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-green-900/20 border-green-800 text-green-400'}`}>
            {msg.texto}
          </div>
        )}

        {/* Formulário novo POP */}
        {mostraNovo && (
          <div className="bg-[#1a1a24] rounded-xl border border-blue-900 p-6 mb-6">
            <h2 className="text-white font-medium mb-4">Novo POP</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Título *</label>
                <input value={novoForm.titulo} onChange={e => setNovoForm({...novoForm, titulo: e.target.value})}
                  placeholder="Ex: Como realizar ordem de serviço" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Categoria</label>
                <select value={novoForm.categoria} onChange={e => setNovoForm({...novoForm, categoria: e.target.value})}
                  className={inputCls}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">Conteúdo *</label>
              <textarea
                value={novoForm.conteudo}
                onChange={e => setNovoForm({...novoForm, conteudo: e.target.value})}
                placeholder="Descreva o procedimento passo a passo..."
                rows={10}
                className={inputCls + ' resize-y'}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={salvarNovo} disabled={!novoForm.titulo.trim() || !novoForm.conteudo.trim() || salvando}
                className="bg-[#071DE3] hover:bg-[#0516B0] disabled:opacity-40 text-white text-sm px-6 py-2 rounded-lg transition font-medium">
                {salvando ? 'Salvando...' : 'Salvar POP'}
              </button>
              <button onClick={() => setMostraNovo(false)}
                className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-6 py-2 rounded-lg transition">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Busca e filtros */}
        <div className="flex gap-3 mb-4">
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por título ou conteúdo..."
            className="flex-1 bg-[#1a1a24] border border-gray-800 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#071DE3] transition"
          />
          <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)}
            className="bg-[#1a1a24] border border-gray-800 rounded-lg px-3 py-2 text-gray-300 text-sm focus:outline-none focus:border-[#071DE3]">
            {categorias.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Lista de POPs */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-[#1a1a24] rounded-xl border border-gray-800 h-16 animate-pulse" />)}
          </div>
        ) : popsFiltrados.length === 0 ? (
          <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-400">{busca || categoriaFiltro !== 'Todas' ? 'Nenhum POP encontrado com esses filtros.' : 'Nenhum POP cadastrado ainda.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {popsFiltrados.map(pop => (
              <div key={pop.id} className="bg-[#1a1a24] rounded-xl border border-gray-800 overflow-hidden">
                {/* Cabeçalho do POP */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-800/30 transition"
                  onClick={() => editandoId !== pop.id && setExpandido(expandido === pop.id ? null : pop.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📄</span>
                    <div>
                      <span className="text-white font-medium">{pop.titulo}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        {pop.categoria && (
                          <span className="text-xs bg-blue-900/30 text-blue-400 border border-blue-900/50 px-2 py-0.5 rounded-full">
                            {pop.categoria}
                          </span>
                        )}
                        <span className="text-xs text-gray-600">
                          {new Date(pop.atualizado_em).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={e => { e.stopPropagation(); iniciarEdicao(pop) }}
                      className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition">
                      Editar
                    </button>
                    <button onClick={e => { e.stopPropagation(); excluir(pop.id, pop.titulo) }}
                      className="text-xs text-red-400 bg-red-900/20 hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition">
                      Arquivar
                    </button>
                    <span className={`text-gray-400 transition-transform ${expandido === pop.id ? 'rotate-180' : ''}`}>▾</span>
                  </div>
                </div>

                {/* Conteúdo expandido */}
                {expandido === pop.id && (
                  <div className="border-t border-gray-800 px-5 py-4">
                    {editandoId === pop.id ? (
                      /* Modo edição */
                      <div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Título</label>
                            <input value={editForm.titulo} onChange={e => setEditForm({...editForm, titulo: e.target.value})} className={inputEditCls} />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Categoria</label>
                            <select value={editForm.categoria} onChange={e => setEditForm({...editForm, categoria: e.target.value})} className={inputEditCls}>
                              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>
                        <textarea
                          value={editForm.conteudo}
                          onChange={e => setEditForm({...editForm, conteudo: e.target.value})}
                          rows={15}
                          className={inputEditCls + ' resize-y mb-3'}
                        />
                        <div className="flex gap-3">
                          <button onClick={salvarEdicao} disabled={salvando}
                            className="bg-[#071DE3] hover:bg-[#0516B0] disabled:opacity-40 text-white text-sm px-5 py-2 rounded-lg transition">
                            {salvando ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button onClick={() => setEditandoId(null)}
                            className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-5 py-2 rounded-lg transition">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Modo visualização */
                      <pre className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed font-sans">
                        {pop.conteudo}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
