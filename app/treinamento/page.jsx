'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

export default function TreinamentoPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [regras, setRegras] = useState([])
  const [loading, setLoading] = useState(true)
  const [novaRegra, setNovaRegra] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [editandoTexto, setEditandoTexto] = useState('')
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
    fetchRegras()
  }, [router])

  async function fetchRegras() {
    setLoading(true)
    const r = await fetch('/api/treinamento')
    if (r.ok) setRegras(await r.json())
    setLoading(false)
  }

  function showMsg(texto, tipo = 'success') {
    setMsg({ texto, tipo })
    setTimeout(() => setMsg({ texto: '', tipo: '' }), 3000)
  }

  async function adicionarRegra() {
    if (!novaRegra.trim()) return
    setSalvando(true)
    const r = await fetch('/api/treinamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regra: novaRegra }),
    })
    setSalvando(false)
    if (r.ok) {
      setNovaRegra('')
      showMsg('Regra adicionada com sucesso!')
      fetchRegras()
    } else {
      const data = await r.json().catch(() => ({}))
      showMsg('Erro: ' + (data.error || r.status), 'error')
    }
  }

  async function salvarEdicao(id) {
    if (!editandoTexto.trim()) return
    setSalvando(true)
    const r = await fetch(`/api/treinamento/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regra: editandoTexto }),
    })
    setSalvando(false)
    if (r.ok) {
      setEditandoId(null)
      showMsg('Regra atualizada!')
      fetchRegras()
    } else {
      showMsg('Erro ao salvar', 'error')
    }
  }

  async function excluirRegra(id, texto) {
    if (!confirm(`Excluir esta regra?\n\n"${texto}"`)) return
    const r = await fetch(`/api/treinamento/${id}`, { method: 'DELETE' })
    if (r.ok) {
      showMsg('Regra removida.')
      fetchRegras()
    } else {
      showMsg('Erro ao excluir', 'error')
    }
  }

  function iniciarEdicao(regra) {
    setEditandoId(regra.id)
    setEditandoTexto(regra.regra)
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditandoTexto('')
  }

  return (
    <div className="min-h-screen bg-[#0f0f13]">
      <Navbar user={user} />
      <main className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-white">Treinamento da IA 🧠</h1>
            <p className="text-gray-400 text-sm mt-1">
              Regras e instruções que o Maluco da IA segue em todas as respostas
            </p>
          </div>
          <span className="bg-purple-900/40 text-purple-300 border border-purple-800 text-sm px-3 py-1 rounded-full">
            {regras.length} {regras.length === 1 ? 'regra' : 'regras'}
          </span>
        </div>

        {/* Info */}
        <div className="bg-blue-900/20 border border-blue-800 rounded-xl px-5 py-3 mb-6 text-sm text-blue-300">
          💡 Essas regras são aplicadas em <strong>todas</strong> as respostas do bot. Use para definir comportamentos, proibições, formatos de resposta ou informações fixas da empresa. Os colaboradores também podem ensinar o bot via WhatsApp com <code className="bg-blue-900/40 px-1 rounded">Claude aprenda: ...</code>
        </div>

        {/* Mensagem de feedback */}
        {msg.texto && (
          <div className={`mb-4 text-sm px-4 py-2.5 rounded-lg border ${
            msg.tipo === 'error'
              ? 'bg-red-900/20 border-red-800 text-red-400'
              : 'bg-green-900/20 border-green-800 text-green-400'
          }`}>
            {msg.texto}
          </div>
        )}

        {/* Adicionar nova regra */}
        <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-5 mb-6">
          <h2 className="text-white font-medium mb-3">+ Adicionar nova regra</h2>
          <textarea
            value={novaRegra}
            onChange={e => setNovaRegra(e.target.value)}
            placeholder="Ex: Sempre responda em português formal. Nunca mencione preços sem consultar a tabela oficial."
            rows={3}
            className="w-full bg-[#0f0f13] border border-gray-700 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none transition"
          />
          <div className="flex justify-between items-center mt-3">
            <span className="text-xs text-gray-500">{novaRegra.length} caracteres</span>
            <button
              onClick={adicionarRegra}
              disabled={!novaRegra.trim() || salvando}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-sm px-5 py-2 rounded-lg transition font-medium"
            >
              {salvando ? 'Salvando...' : 'Adicionar Regra'}
            </button>
          </div>
        </div>

        {/* Lista de regras */}
        <div className="bg-[#1a1a24] rounded-xl border border-gray-800">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-white font-medium">Regras ativas</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : regras.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl mb-3">🤖</div>
              <p className="text-gray-400">Nenhuma regra cadastrada ainda.</p>
              <p className="text-gray-600 text-sm mt-1">Adicione regras para personalizar o comportamento do bot.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {regras.map((r, i) => (
                <div key={r.id} className="px-5 py-4 group">
                  {editandoId === r.id ? (
                    /* Modo edição */
                    <div>
                      <div className="text-xs text-purple-400 mb-2 font-medium">Editando regra #{i + 1}</div>
                      <textarea
                        value={editandoTexto}
                        onChange={e => setEditandoTexto(e.target.value)}
                        rows={3}
                        className="w-full bg-[#0f0f13] border border-purple-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 resize-none"
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => salvarEdicao(r.id)}
                          disabled={salvando}
                          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs px-4 py-1.5 rounded-lg transition"
                        >
                          {salvando ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                          onClick={cancelarEdicao}
                          className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-4 py-1.5 rounded-lg transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Modo visualização */
                    <div className="flex items-start gap-4">
                      <span className="text-xs text-gray-600 font-mono mt-0.5 w-6 text-right shrink-0">{i + 1}</span>
                      <p className="text-gray-200 text-sm flex-1 leading-relaxed whitespace-pre-wrap">{r.regra}</p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                        <button
                          onClick={() => iniciarEdicao(r)}
                          className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => excluirRegra(r.id, r.regra)}
                          className="text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
