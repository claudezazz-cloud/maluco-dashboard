'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { Hash, ClipboardList, ArrowDownToLine, ArrowUpFromLine, MessageSquare, AlertTriangle, X, ChevronLeft, ChevronRight, ChevronDown, Trash2, CheckCircle2 } from 'lucide-react'

function fmtData(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function TokenBadge({ input, output }) {
  const total = (input || 0) + (output || 0)
  if (!total) return null
  return (
    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
      <Hash className="w-3 h-3 inline" /> {total.toLocaleString()} tokens
    </span>
  )
}

function PopsBadges({ pops }) {
  if (!pops) return null
  const lista = pops.split(',').map(p => p.trim()).filter(Boolean)
  if (!lista.length) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {lista.map((p, i) => {
        const isLeiaSempre = p.toLowerCase().startsWith('leia sempre')
        return (
          <span
            key={i}
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md ${
              isLeiaSempre
                ? 'bg-amber-500/15 text-amber-300'
                : 'bg-emerald-500/10 text-emerald-300'
            }`}
          >
            <ClipboardList className="w-3 h-3 opacity-70" />
            <span className="truncate max-w-[280px]">{p}</span>
          </span>
        )
      })}
    </div>
  )
}

function ConversaCard({ conv }) {
  const [expandido, setExpandido] = useState(false)
  return (
    <div className="bg-surface-raised rounded-xl border border-white/[0.06] overflow-hidden">
      <div
        className="px-5 py-4 cursor-pointer hover:bg-gray-800/20 transition"
        onClick={() => setExpandido(!expandido)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white font-medium text-sm">{conv.remetente || 'Desconhecido'}</span>
              <span className="text-xs text-gray-600">{fmtData(conv.criado_em)}</span>
              <TokenBadge input={conv.tokens_input} output={conv.tokens_output} />
            </div>
            <p className="text-gray-300 text-sm truncate">
              <span className="text-gray-500">→ </span>{conv.mensagem}
            </p>
            <p className="text-gray-500 text-sm truncate mt-0.5">
              <span className="text-green-600">← </span>{conv.resposta}
            </p>
            <PopsBadges pops={conv.pops_usados} />
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-600 mt-1 transition-transform flex-shrink-0 ${expandido ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expandido && (
        <div className="border-t border-white/[0.06] px-5 py-4 space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Mensagem do colaborador</p>
            <p className="text-gray-200 text-sm whitespace-pre-wrap bg-gray-900/50 rounded-lg p-3">{conv.mensagem}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Resposta do bot</p>
            <p className="text-gray-200 text-sm whitespace-pre-wrap bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">{conv.resposta}</p>
          </div>
          {conv.pops_usados && (
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">POPs utilizados</p>
              <PopsBadges pops={conv.pops_usados} />
            </div>
          )}
          <div className="flex gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1"><ArrowDownToLine className="w-3 h-3" /> Input: {(conv.tokens_input || 0).toLocaleString()} tokens</span>
            <span className="flex items-center gap-1"><ArrowUpFromLine className="w-3 h-3" /> Output: {(conv.tokens_output || 0).toLocaleString()} tokens</span>
            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Chat: {conv.chat_id}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ConversasPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [aba, setAba] = useState('conversas')
  const [conversas, setConversas] = useState([])
  const [erros, setErros] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [buscaInput, setBuscaInput] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [limpando, setLimpando] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) { router.push('/login'); return null }
      return r.json()
    }).then(d => { if (d) setUser(d) })
  }, [router])

  const fetchConversas = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit: 30 })
    if (busca) params.set('busca', busca)
    const r = await fetch(`/api/conversas?${params}`)
    if (r.ok) {
      const d = await r.json()
      setConversas(d.conversas)
      setTotalPages(d.totalPages || 1)
      setTotal(d.total || 0)
    }
    setLoading(false)
  }, [page, busca])

  const fetchErros = useCallback(async () => {
    const r = await fetch('/api/erros')
    if (r.ok) setErros(await r.json())
  }, [])

  useEffect(() => {
    if (aba === 'conversas') fetchConversas()
    else fetchErros()
  }, [aba, fetchConversas, fetchErros])

  async function limparErros() {
    if (!confirm('Apagar erros com mais de 7 dias?')) return
    setLimpando(true)
    await fetch('/api/erros', { method: 'DELETE' })
    setLimpando(false)
    fetchErros()
  }

  function pesquisar() {
    setBusca(buscaInput)
    setPage(1)
  }

  const abaBtn = (nome, label) => (
    <button
      onClick={() => { setAba(nome); setPage(1) }}
      className={`px-4 py-2 text-sm rounded-lg transition font-medium ${aba === nome ? 'bg-brand text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-surface">
      <Navbar user={user} />
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2"><MessageSquare className="w-6 h-6 text-[#008000]" /> Conversas</h1>
            <p className="text-gray-400 text-sm mt-1">Histórico de interações e erros do bot</p>
          </div>
          <div className="flex gap-2">
            {abaBtn('conversas', <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> Conversas {aba === 'conversas' ? `(${total})` : ''}</span>)}
            {abaBtn('erros', <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Erros {aba === 'erros' && erros.length ? `(${erros.length})` : ''}</span>)}
          </div>
        </div>

        {/* ABA CONVERSAS */}
        {aba === 'conversas' && (
          <>
            {/* Busca */}
            <div className="flex gap-2 mb-4">
              <input
                value={buscaInput}
                onChange={e => setBuscaInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && pesquisar()}
                placeholder="Buscar em mensagens, respostas, remetente..."
                className="flex-1 bg-surface-raised border border-white/[0.06] rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#008000] transition"
              />
              <button
                onClick={pesquisar}
                className="bg-brand hover:bg-brand-dark text-white text-sm px-4 py-2 rounded-lg transition"
              >
                Buscar
              </button>
              {busca && (
                <button
                  onClick={() => { setBusca(''); setBuscaInput(''); setPage(1) }}
                  className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-2 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map(i => <div key={i} className="bg-surface-raised rounded-xl border border-white/[0.06] h-20 animate-pulse" />)}
              </div>
            ) : conversas.length === 0 ? (
              <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-12 text-center">
                <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">{busca ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa registrada ainda.'}</p>
                <p className="text-gray-600 text-sm mt-1">As conversas aparecem aqui após o workflow ser atualizado.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {conversas.map(conv => <ConversaCard key={conv.id} conv={conv} />)}
              </div>
            )}

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white rounded-lg transition"
                >
                  <ChevronLeft className="w-4 h-4 inline" /> Anterior
                </button>
                <span className="text-gray-400 text-sm">Página {page} de {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white rounded-lg transition"
                >
                  Próxima <ChevronRight className="w-4 h-4 inline" />
                </button>
              </div>
            )}
          </>
        )}

        {/* ABA ERROS */}
        {aba === 'erros' && (
          <>
            <div className="flex justify-end mb-4">
              <button
                onClick={limparErros}
                disabled={limpando}
                className="text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/30 px-3 py-1.5 rounded-lg transition disabled:opacity-40"
              >
                {limpando ? 'Limpando...' : <span className="flex items-center gap-1"><Trash2 className="w-3 h-3" /> Limpar erros antigos (+7 dias)</span>}
              </button>
            </div>

            {erros.length === 0 ? (
              <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
                <p className="text-gray-400">Nenhum erro registrado.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {erros.map(erro => (
                  <div key={erro.id} className="bg-surface-raised rounded-xl border border-red-900/40 overflow-hidden">
                    <div className="px-5 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-red-400 text-sm font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {erro.no_n8n}</span>
                          <span className="text-xs text-gray-600">{fmtData(erro.criado_em)}</span>
                        </div>
                        {erro.chat_id && (
                          <span className="text-xs text-gray-600">Chat: {erro.chat_id}</span>
                        )}
                      </div>
                      <p className="text-red-300 text-sm bg-red-900/10 rounded-lg px-3 py-2 font-mono">
                        {erro.mensagem_erro}
                      </p>
                      {erro.mensagem_usuario && (
                        <p className="text-gray-500 text-xs mt-2">
                          <span className="text-gray-600">Mensagem que causou: </span>
                          {erro.mensagem_usuario}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
