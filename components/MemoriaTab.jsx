'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Brain, CalendarDays, BookOpen, User, RefreshCw,
  ChevronDown, ChevronRight, CheckCircle2, XCircle,
  AlertTriangle, Pencil, Eye, EyeOff, Search, Play
} from 'lucide-react'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtData(d) {
  if (!d) return '--'
  // Postgres `date` chega serializado como ISO 'YYYY-MM-DDT00:00:00.000Z' (UTC midnight).
  // Converter direto pra Date local em BRT (UTC-3) perde 3h e cai no dia anterior.
  // Solucao: extrair YYYY-MM-DD literal sem timezone.
  const s = typeof d === 'string' ? d : (d instanceof Date ? d.toISOString() : String(d))
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtTs(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function PesoBadge({ peso }) {
  const color = peso >= 8 ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : peso >= 6 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    : 'bg-gray-700 text-gray-400 border-gray-600'
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-mono ${color}`}>
      P{peso}
    </span>
  )
}

function TipoBadge({ tipo }) {
  const map = {
    cliente:      'bg-blue-500/20 text-blue-300',
    colaborador:  'bg-purple-500/20 text-purple-300',
    regiao:       'bg-green-500/20 text-green-300',
    equipamento:  'bg-orange-500/20 text-orange-300',
    empresa:      'bg-gray-600 text-gray-300',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${map[tipo] || 'bg-gray-700 text-gray-400'}`}>
      {tipo}
    </span>
  )
}

// ─── Subaba 1: Resumos Diários ────────────────────────────────────────────────

function ResumosDiariosTab() {
  const [resumos, setResumos]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [expandido, setExpandido]   = useState(null)
  const [extraindo, setExtraindo]   = useState(false)
  const [msg, setMsg]               = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/memoria/resumos?limit=60')
      const d = await r.json()
      setResumos(Array.isArray(d) ? d : [])
    } catch { setResumos([]) }
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function extrairAgora() {
    setExtraindo(true)
    setMsg('')
    try {
      const r = await fetch('/api/memoria/extrair-dia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const d = await r.json()
      if (d.triggered) {
        setMsg('Extração disparada! Os resumos aparecerão em alguns minutos.')
        setTimeout(carregar, 15000)
      } else {
        setMsg(d.error || 'Erro ao disparar extração.')
      }
    } catch (e) { setMsg(e.message) }
    setExtraindo(false)
  }

  if (loading) return <div className="text-gray-500 p-6">Carregando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {resumos.length} resumo(s) — atualizado a cada 30 min automaticamente
        </p>
        <div className="flex gap-2">
          <button onClick={carregar}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-500 transition">
            <RefreshCw className="w-3 h-3" /> Atualizar
          </button>
          <button onClick={extrairAgora} disabled={extraindo}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#071DE3] text-white hover:bg-blue-700 transition disabled:opacity-50">
            <Play className="w-3 h-3" /> {extraindo ? 'Disparando...' : 'Extrair Agora'}
          </button>
        </div>
      </div>

      {msg && (
        <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
          {msg}
        </div>
      )}

      {resumos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum resumo ainda. Clique em "Extrair Agora" para gerar o primeiro.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {resumos.map(r => (
            <div key={r.id} className="bg-[#1a1a24] border border-gray-800 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/40 transition text-left"
                onClick={() => setExpandido(expandido === r.id ? null : r.id)}>
                <div className="flex items-center gap-3">
                  <CalendarDays className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-200">{fmtData(r.data)}</span>
                  <span className="text-xs text-gray-500 font-mono truncate max-w-[140px]">{r.chat_id}</span>
                  <span className="text-xs text-gray-600">{r.total_mensagens} msgs</span>
                </div>
                {expandido === r.id
                  ? <ChevronDown className="w-4 h-4 text-gray-500" />
                  : <ChevronRight className="w-4 h-4 text-gray-500" />}
              </button>

              {expandido === r.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-800/60">
                  <p className="text-sm text-gray-300 pt-3 leading-relaxed">{r.resumo}</p>

                  {r.pessoas_ativas?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {r.pessoas_ativas.map((p, i) => (
                        <span key={i} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}

                  {r.solicitacoes_abertas?.length > 0 && (
                    <div>
                      <p className="text-xs text-amber-400 font-semibold mb-1">Pendentes ({r.solicitacoes_abertas.length})</p>
                      <ul className="space-y-1">
                        {r.solicitacoes_abertas.map((s, i) => (
                          <li key={i} className="text-xs text-gray-400 flex gap-2">
                            <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                            <span><b className="text-gray-300">{s.cliente}</b> — {s.descricao} {s.hora && <span className="text-gray-600">({s.hora})</span>}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {r.solicitacoes_resolvidas?.length > 0 && (
                    <div>
                      <p className="text-xs text-emerald-400 font-semibold mb-1">Resolvidas ({r.solicitacoes_resolvidas.length})</p>
                      <ul className="space-y-1">
                        {r.solicitacoes_resolvidas.map((s, i) => (
                          <li key={i} className="text-xs text-gray-400 flex gap-2">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                            <span><b className="text-gray-300">{s.cliente}</b> — {s.descricao}{s.resolvido_por && <span className="text-gray-500"> (por {s.resolvido_por})</span>}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {r.decisoes?.length > 0 && (
                    <div>
                      <p className="text-xs text-blue-400 font-semibold mb-1">Decisões</p>
                      <ul className="space-y-1">
                        {r.decisoes.map((d, i) => (
                          <li key={i} className="text-xs text-gray-400">• {d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-xs text-gray-600">Gerado em {fmtTs(r.gerado_em)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Subaba 2: Fatos Aprendidos ───────────────────────────────────────────────

function FatosTab() {
  const [fatos, setFatos]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [busca, setBusca]         = useState('')
  const [editando, setEditando]   = useState(null)
  const [extraindo, setExtraindo] = useState(false)
  const [msg, setMsg]             = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/memoria/resumos?limit=1') // só pra testar se endpoint existe
      // Busca fatos via entidade genérica (todos)
      const fe = await fetch('/api/memoria/entidade/empresa/Zazz')
      const fc = await fetch('/api/memoria/entidade/cliente/_all_')
      // Para listar TODOS os fatos, usamos a rota de resumos invertida —
      // na prática o admin vai usar filtro por entidade
      // Aqui buscamos os mais relevantes
      const todos = await fetch('/api/memoria/entidade/colaborador/_all_')
      // Workaround: buscamos fatos via endpoint próprio (se criado) ou via múltiplas calls
      // Como não temos "listar todos", fazemos GET /api/memoria/resumos para contar
      // e buscamos por tipo
      const tipos = ['cliente','colaborador','regiao','equipamento','empresa']
      const results = await Promise.all(
        tipos.map(t => fetch(`/api/memoria/entidade/${t}/_all_`).then(r => r.json()).catch(() => []))
      )
      // Filtra arrays válidos
      const merged = results.flat().filter(f => f && f.id)
      setFatos(merged)
    } catch { setFatos([]) }
    setLoading(false)
  }, [])

  // Busca real: por entidade_tipo
  const carregarPorTipo = useCallback(async (tipo) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/memoria/entidade/${tipo || 'empresa'}/_all_`)
      const d = await r.json()
      setFatos(Array.isArray(d) ? d : [])
    } catch { setFatos([]) }
    setLoading(false)
  }, [])

  useEffect(() => {
    // Carrega fatos de todos os tipos conhecidos
    async function loadAll() {
      setLoading(true)
      const tipos = ['cliente','colaborador','regiao','equipamento','empresa']
      const results = await Promise.all(
        tipos.map(t =>
          fetch(`/api/memoria/entidade/${t}/_all_`)
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
        )
      )
      setFatos(results.flat().filter(f => f && f.id))
      setLoading(false)
    }
    loadAll()
  }, [])

  async function toggleAtivo(fato) {
    await fetch(`/api/memoria/fato/${fato.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !fato.ativo })
    })
    setFatos(prev => prev.map(f => f.id === fato.id ? { ...f, ativo: !f.ativo } : f))
  }

  async function salvarEdicao(fato, novoFato, novoPeso) {
    const r = await fetch(`/api/memoria/fato/${fato.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fato: novoFato, peso: novoPeso, validado_por: 'Admin' })
    })
    const updated = await r.json()
    setFatos(prev => prev.map(f => f.id === fato.id ? { ...f, ...updated } : f))
    setEditando(null)
  }

  async function extrairLonga() {
    setExtraindo(true)
    setMsg('')
    try {
      const r = await fetch('/api/memoria/extrair-longa', { method: 'POST' })
      const d = await r.json()
      setMsg(d.triggered ? 'Extração de fatos disparada! Resultados em alguns minutos.' : (d.error || 'Erro'))
    } catch (e) { setMsg(e.message) }
    setExtraindo(false)
  }

  const tipos = ['', 'cliente', 'colaborador', 'regiao', 'equipamento', 'empresa']
  const fatosFiltrados = fatos.filter(f => {
    if (filtroTipo && f.entidade_tipo !== filtroTipo) return false
    if (busca) {
      const b = busca.toLowerCase()
      return (f.fato || '').toLowerCase().includes(b) || (f.entidade_id || '').toLowerCase().includes(b)
    }
    return true
  })

  if (loading) return <div className="text-gray-500 p-6">Carregando...</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-gray-500" />
          <input
            className="bg-transparent text-sm text-gray-200 outline-none w-full placeholder-gray-600"
            placeholder="Buscar fatos..."
            value={busca} onChange={e => setBusca(e.target.value)}
          />
        </div>
        <select
          className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 outline-none"
          value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          {tipos.map(t => <option key={t} value={t}>{t || 'Todos os tipos'}</option>)}
        </select>
        <button onClick={extrairLonga} disabled={extraindo}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#071DE3] text-white hover:bg-blue-700 disabled:opacity-50 transition">
          <Play className="w-3 h-3" /> {extraindo ? 'Disparando...' : 'Extrair Fatos'}
        </button>
      </div>

      {msg && (
        <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
          {msg}
        </div>
      )}

      <p className="text-xs text-gray-500">{fatosFiltrados.length} fato(s) encontrado(s)</p>

      {fatosFiltrados.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum fato ainda. O bot aprende automaticamente toda madrugada.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {fatosFiltrados.map(f => (
            <div key={f.id} className={`bg-[#1a1a24] border rounded-xl px-4 py-3 transition ${f.ativo ? 'border-gray-800' : 'border-gray-800/40 opacity-50'}`}>
              {editando === f.id ? (
                <EditFatoInline fato={f} onSave={salvarEdicao} onCancel={() => setEditando(null)} />
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <TipoBadge tipo={f.entidade_tipo} />
                      <span className="text-xs text-gray-400 font-medium">{f.entidade_id}</span>
                      <PesoBadge peso={f.peso} />
                      <span className="text-xs text-gray-600">×{f.ocorrencias}</span>
                      {f.validado_por && (
                        <span className="text-xs text-emerald-600">✓ {f.validado_por}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-200 leading-snug">{f.fato}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {f.categoria} · última vez {fmtTs(f.ultima_ocorrencia)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => setEditando(f.id)}
                      className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => toggleAtivo(f)}
                      className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition"
                      title={f.ativo ? 'Desativar' : 'Ativar'}>
                      {f.ativo ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EditFatoInline({ fato, onSave, onCancel }) {
  const [texto, setTexto] = useState(fato.fato)
  const [peso, setPeso]   = useState(fato.peso)

  return (
    <div className="space-y-2">
      <textarea
        className="w-full bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 px-3 py-2 resize-none outline-none focus:border-blue-600"
        rows={3} value={texto} onChange={e => setTexto(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-400">Peso:</label>
        <input type="range" min="1" max="10" value={peso}
          onChange={e => setPeso(parseInt(e.target.value))}
          className="flex-1 accent-blue-600" />
        <span className="text-xs text-gray-300 w-4">{peso}</span>
        <button onClick={() => onSave(fato, texto, peso)}
          className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition">
          Salvar
        </button>
        <button onClick={onCancel}
          className="text-xs px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Subaba 3: Por Cliente ────────────────────────────────────────────────────

const CATEGORIA_CONFIG = {
  problema:    { label: 'Problemas',     color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
  preferencia: { label: 'Preferências', color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
  historico:   { label: 'Histórico',    color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  processo:    { label: 'Processo',     color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  equipamento: { label: 'Equipamento',  color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  financeiro:  { label: 'Financeiro',   color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20' },
}

function PerfilCliente({ cliente }) {
  const fatos = cliente.fatos || []
  const ativos = fatos.filter(f => f.ativo)

  // Agrupa por categoria
  const porCategoria = {}
  for (const f of ativos) {
    const cat = f.categoria || 'historico'
    if (!porCategoria[cat]) porCategoria[cat] = []
    porCategoria[cat].push(f)
  }

  // Score de atenção: clientes com problemas freq ou peso alto
  const temProblema = (porCategoria.problema || []).some(f => f.ocorrencias >= 2 || f.peso >= 7)
  const totalOcorrencias = ativos.reduce((s, f) => s + (f.ocorrencias || 1), 0)

  return (
    <div className="bg-[#1a1a24] border border-gray-800 rounded-xl overflow-hidden">
      {/* Header do cliente */}
      <div className="px-4 py-3 border-b border-gray-800/60 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${temProblema ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
            <User className={`w-4 h-4 ${temProblema ? 'text-red-400' : 'text-blue-400'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-100 truncate">{cliente.entidade_id}</p>
            <p className="text-xs text-gray-500">
              {ativos.length} fato(s) · {totalOcorrencias} ocorrência(s) · último: {fmtTs(cliente.ultima_ocorrencia)}
            </p>
          </div>
        </div>
        {temProblema && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 flex-shrink-0">
            ⚠ Atenção
          </span>
        )}
      </div>

      {/* Fatos por categoria */}
      <div className="p-4 space-y-3">
        {Object.entries(porCategoria)
          .sort(([a], [b]) => {
            const order = ['problema', 'financeiro', 'preferencia', 'equipamento', 'processo', 'historico']
            return (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)
          })
          .map(([cat, lista]) => {
            const cfg = CATEGORIA_CONFIG[cat] || { label: cat, color: 'text-gray-400', bg: 'bg-gray-700/20 border-gray-700' }
            return (
              <div key={cat} className={`rounded-lg border px-3 py-2.5 ${cfg.bg}`}>
                <p className={`text-xs font-semibold mb-2 ${cfg.color}`}>{cfg.label}</p>
                <div className="space-y-2">
                  {lista.sort((a, b) => b.ocorrencias - a.ocorrencias || b.peso - a.peso).map(f => (
                    <div key={f.id} className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 leading-snug">{f.fato}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {f.ocorrencias > 1 && (
                            <span className="text-xs text-gray-500">
                              repetido {f.ocorrencias}× desde {fmtData(f.primeira_ocorrencia)}
                            </span>
                          )}
                          {f.ocorrencias === 1 && (
                            <span className="text-xs text-gray-600">
                              {fmtTs(f.ultima_ocorrencia)}
                            </span>
                          )}
                          {f.validado_por && (
                            <span className="text-xs text-emerald-600">✓ validado</span>
                          )}
                        </div>
                      </div>
                      <PesoBadge peso={f.peso} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

        {/* Fatos inativos colapsados */}
        {fatos.filter(f => !f.ativo).length > 0 && (
          <p className="text-xs text-gray-600 italic">
            + {fatos.filter(f => !f.ativo).length} fato(s) desativado(s) (corrigidos)
          </p>
        )}
      </div>
    </div>
  )
}

function PorClienteTab() {
  const [busca, setBusca]     = useState('')
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(false)
  const [buscado, setBuscado] = useState('')

  async function buscarCliente() {
    if (!busca.trim()) return
    setLoading(true)
    setBuscado(busca.trim())
    try {
      const r = await fetch(`/api/memoria/cliente?q=${encodeURIComponent(busca.trim())}`)
      const d = await r.json()
      setClientes(Array.isArray(d) ? d : [])
    } catch { setClientes([]) }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex items-center gap-2 flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
          <User className="w-4 h-4 text-gray-500" />
          <input
            className="bg-transparent text-sm text-gray-200 outline-none w-full placeholder-gray-600"
            placeholder="Nome do cliente, código ou parte do nome..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscarCliente()}
          />
        </div>
        <button onClick={buscarCliente} disabled={loading}
          className="px-4 py-2 bg-[#071DE3] text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
          {loading ? '...' : 'Buscar'}
        </button>
      </div>

      {buscado && !loading && (
        <p className="text-xs text-gray-500">
          {clientes.length} cliente(s) encontrado(s) para "{buscado}"
        </p>
      )}

      {clientes.length === 0 && buscado && !loading && (
        <div className="text-center py-8 text-gray-500">
          <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>Nenhum histórico registrado para este cliente ainda.</p>
          <p className="text-xs mt-1">O bot aprende automaticamente com as conversas do grupo.</p>
        </div>
      )}

      {clientes.length > 0 && (
        <div className="space-y-4">
          {clientes.map(c => <PerfilCliente key={c.entidade_id} cliente={c} />)}
        </div>
      )}

      {!buscado && (
        <div className="text-center py-12 text-gray-500">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Digite o nome do cliente para ver o histórico que o bot aprendeu.</p>
          <p className="text-xs mt-2 text-gray-600">Problemas recorrentes, preferências, equipamentos, histórico de atendimento.</p>
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MemoriaTab() {
  const [sub, setSub] = useState('resumos')

  const subs = [
    { key: 'resumos',  label: 'Resumos Diários', icon: CalendarDays },
    { key: 'fatos',    label: 'Fatos Aprendidos', icon: BookOpen },
    { key: 'cliente',  label: 'Por Cliente',      icon: User },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="w-5 h-5 text-blue-400" />
        <h2 className="text-lg font-semibold text-gray-100">Memória do Bot</h2>
        <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
          Beta
        </span>
      </div>

      {/* Sub-navegação */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800">
        {subs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSub(key)}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg flex-1 justify-center transition ${
              sub === key
                ? 'bg-[#071DE3] text-white font-medium'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {sub === 'resumos' && <ResumosDiariosTab />}
      {sub === 'fatos'   && <FatosTab />}
      {sub === 'cliente' && <PorClienteTab />}
    </div>
  )
}
