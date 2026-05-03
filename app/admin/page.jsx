'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { Eye, EyeOff, Clock, Users, MessageSquare, Pencil, Trash2, Plus, Check, X, Package, CheckCircle2 } from 'lucide-react'

// ── Métricas helpers ──────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, highlight }) {
  return (
    <div className={`bg-surface-raised rounded-xl border px-5 py-4 flex flex-col gap-1 ${highlight ? 'border-brand/40' : 'border-white/[0.06]'}`}>
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-3xl font-bold font-display ${highlight ? 'text-brand' : 'text-white'}`}>{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

function SvgBarChart({ data }) {
  if (!data || data.length === 0) return <div className="text-gray-600 text-sm text-center py-8">Sem dados</div>

  const H = 100
  const maxVal = Math.max(...data.map(d => d.criadas), 1)
  const n = data.length

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${n * 12} ${H + 20}`} className="w-full overflow-visible" preserveAspectRatio="none">
        {data.map((d, i) => {
          const barH = Math.max(1, Math.round((d.criadas / maxVal) * H))
          const concH = Math.max(0, Math.round((d.concluidas / maxVal) * H))
          const x = i * 12
          return (
            <g key={d.data}>
              <rect x={x + 1} y={H - barH} width={9} height={barH} fill="rgba(0,200,83,0.18)" rx="1" />
              <rect x={x + 1} y={H - concH} width={9} height={concH} fill="#00c853" rx="1" />
            </g>
          )
        })}
      </svg>
      <div className="flex gap-4 justify-end mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded-sm bg-brand/30" />Criadas</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded-sm bg-brand" />Concluídas</span>
      </div>
    </div>
  )
}

function MetricasTab() {
  const [periodo, setPeriodo] = useState('30d')
  const [customInicio, setCustomInicio] = useState('')
  const [customFim, setCustomFim] = useState('')
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async (p, ini, fim) => {
    setLoading(true)
    setErro('')
    try {
      let url = `/api/admin/metricas/notion?periodo=${p}`
      if (p === 'custom' && ini && fim) url += `&inicio=${ini}&fim=${fim}`
      const r = await fetch(url)
      const d = await r.json()
      if (!r.ok) { setErro(d.error || 'Erro ao carregar métricas'); setDados(null) }
      else setDados(d)
    } catch (e) {
      setErro(e.message)
      setDados(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { carregar('30d') }, [carregar])

  function selecionarPeriodo(p) {
    setPeriodo(p)
    if (p !== 'custom') carregar(p)
  }

  function aplicarCustom() {
    if (customInicio && customFim) carregar('custom', customInicio, customFim)
  }

  const periodos = [['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias'], ['custom', 'Personalizado']]

  const r = dados?.resumo

  return (
    <div className="animate-fade-in">
      {/* Mensagem executiva */}
      <div className="mb-6 bg-brand/10 border border-brand/30 rounded-xl px-5 py-4">
        <p className="text-brand font-semibold text-sm">
          As chances de esquecer tarefas de internet caída diminuíram significativamente com o registro no Notion!
        </p>
        <p className="text-gray-400 text-xs mt-1">
          Cada chamado registrado aqui é uma tarefa que não será esquecida. Acompanhe abaixo.
        </p>
      </div>

      {/* Filtros de período */}
      <div className="flex flex-wrap gap-2 mb-6">
        {periodos.map(([key, label]) => (
          <button
            key={key}
            onClick={() => selecionarPeriodo(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${periodo === key ? 'bg-brand text-white' : 'bg-surface-raised text-gray-400 hover:text-white border border-white/[0.06]'}`}
          >
            {label}
          </button>
        ))}
        {periodo === 'custom' && (
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={customInicio}
              onChange={e => setCustomInicio(e.target.value)}
              className="bg-surface border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:border-brand focus:outline-none"
            />
            <span className="text-gray-500 text-sm">até</span>
            <input
              type="date"
              value={customFim}
              onChange={e => setCustomFim(e.target.value)}
              className="bg-surface border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:border-brand focus:outline-none"
            />
            <button
              onClick={aplicarCustom}
              disabled={!customInicio || !customFim}
              className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-sm px-4 py-1.5 rounded-lg transition"
            >
              Aplicar
            </button>
          </div>
        )}
        <button
          onClick={() => carregar(periodo === 'custom' ? 'custom' : periodo, customInicio, customFim)}
          disabled={loading}
          className="ml-auto text-xs text-gray-500 hover:text-white transition"
        >
          {loading ? 'Carregando...' : '↻ Atualizar'}
        </button>
      </div>

      {/* Erro */}
      {erro && (
        <div className="mb-6 bg-red-900/20 border border-red-800 rounded-xl px-5 py-4 text-red-400 text-sm">
          {erro}
        </div>
      )}

      {/* Skeleton / Cards */}
      {loading && !dados ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-surface-raised rounded-xl border border-white/[0.06] px-5 py-4 h-24 animate-pulse" />
          ))}
        </div>
      ) : r ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <MetricCard label="Anotações (7 dias)" value={r.total7d} sub="tarefas registradas" />
          <MetricCard label="Anotações (30 dias)" value={r.total30d} sub="tarefas registradas" />
          <MetricCard
            label={`Concluídas (${periodo === 'hoje' ? 'hoje' : periodo === '7d' ? '7 dias' : periodo === '30d' ? '30 dias' : 'período'})`}
            value={`${r.taxaConclusao}%`}
            sub={`${r.totalConcluidas} de ${r.totalCriadas} resolvidas`}
            highlight
          />
          <MetricCard
            label="Redução de esquecimentos"
            value={`${r.reducaoEsquecimentos}%`}
            sub={`${r.totalPendentes} ainda pendente${r.totalPendentes !== 1 ? 's' : ''}`}
            highlight={r.reducaoEsquecimentos >= 50}
          />
        </div>
      ) : null}

      {/* Gráfico */}
      {dados?.grafico && (
        <div className="bg-surface-raised rounded-xl border border-white/[0.06] px-5 py-4 mb-4">
          <h3 className="text-gray-300 font-medium text-sm mb-4">Evolução diária — últimos 30 dias</h3>
          <SvgBarChart data={dados.grafico} />
        </div>
      )}

      {/* Tabela */}
      {dados?.tabela && dados.tabela.length > 0 && (
        <div className="bg-surface-raised rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06]">
            <h3 className="text-gray-300 font-medium text-sm">
              Resumo por dia
              {dados.periodo && <span className="text-gray-600 font-normal ml-2 text-xs">({dados.periodo.inicio} → {dados.periodo.fim})</span>}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left px-5 py-2.5 text-gray-500 font-medium text-xs uppercase tracking-wide">Data</th>
                  <th className="text-right px-5 py-2.5 text-gray-500 font-medium text-xs uppercase tracking-wide">Criadas</th>
                  <th className="text-right px-5 py-2.5 text-gray-500 font-medium text-xs uppercase tracking-wide">Concluídas</th>
                  <th className="text-right px-5 py-2.5 text-gray-500 font-medium text-xs uppercase tracking-wide">Pendentes</th>
                </tr>
              </thead>
              <tbody>
                {dados.tabela.map((row, i) => (
                  <tr key={row.data} className={`border-b border-white/[0.03] hover:bg-white/[0.02] ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                    <td className="px-5 py-2.5 text-gray-300 font-mono text-xs">
                      {new Date(row.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-5 py-2.5 text-right text-white">{row.criadas}</td>
                    <td className="px-5 py-2.5 text-right text-brand">{row.concluidas}</td>
                    <td className="px-5 py-2.5 text-right text-yellow-500">{row.pendentes}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-white/[0.06]">
                <tr>
                  <td className="px-5 py-2.5 text-gray-500 text-xs font-medium">Total</td>
                  <td className="px-5 py-2.5 text-right text-white font-semibold">{r?.totalCriadas ?? 0}</td>
                  <td className="px-5 py-2.5 text-right text-brand font-semibold">{r?.totalConcluidas ?? 0}</td>
                  <td className="px-5 py-2.5 text-right text-yellow-500 font-semibold">{r?.totalPendentes ?? 0}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {dados && dados.tabela?.length === 0 && !loading && !erro && (
        <div className="text-center py-12 text-gray-500 text-sm">
          Nenhuma tarefa encontrada no período selecionado.
          <br /><span className="text-xs mt-1 block">Verifique as variáveis NOTION_TOKEN, NOTION_DATABASE_ID e os filtros de propriedade.</span>
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [filiais, setFiliais] = useState([])
  const [tab, setTab] = useState('filiais')
  const [msg, setMsg] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [grupoNotifOk, setGrupoNotifOk] = useState('')
  const [salvandoNotifOk, setSalvandoNotifOk] = useState(false)
  const [grupoNotifEntrega, setGrupoNotifEntrega] = useState('')
  const [salvandoNotifEntrega, setSalvandoNotifEntrega] = useState(false)

  // ===== SOLICITAÇÕES =====
  const [solicitacoes, setSolicitacoes] = useState([])
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(true)
  const [novaSolicitacao, setNovaSolicitacao] = useState({ nome: '', comando: '', chat_id: '', hora: '17:00', dias_semana: 'seg,ter,qua,qui,sex' })
  const [mostraNovaSolicitacao, setMostraNovaSolicitacao] = useState(false)
  const [editandoSolicitacao, setEditandoSolicitacao] = useState(null)
  const [editSolicitacaoForm, setEditSolicitacaoForm] = useState({})
  const [msgSolicitacao, setMsgSolicitacao] = useState({ texto: '', tipo: '' })
  const [salvandoSolicitacao, setSalvandoSolicitacao] = useState(false)

  // ===== GRUPOS =====
  const [grupos, setGrupos] = useState([])
  const [loadingGrupos, setLoadingGrupos] = useState(true)
  const [editandoGrupo, setEditandoGrupo] = useState(null)
  const [editGrupoForm, setEditGrupoForm] = useState({})
  const [mostraNovoGrupo, setMostraNovoGrupo] = useState(false)
  const [novoGrupo, setNovoGrupo] = useState({ nome: '', chat_id: '', descricao: '', alertas_notion_entrega: false, alertas_notion_ok: false, tipos_filtro_entrega: [], tipos_filtro_ok: [] })
  const [salvandoGrupo, setSalvandoGrupo] = useState(false)
  const [msgGrupos, setMsgGrupos] = useState({ texto: '', tipo: '' })
  const [tiposNotion, setTiposNotion] = useState([])

  // Usuarios
  const [usuarios, setUsuarios] = useState([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)
  const [mostraNovoUsuario, setMostraNovoUsuario] = useState(false)
  const [novoUsuario, setNovoUsuario] = useState({ nome: '', email: '', senha: '', role: 'colaborador' })
  const [salvandoUsuario, setSalvandoUsuario] = useState(false)
  const [editandoUsuario, setEditandoUsuario] = useState(null)
  const [editUsuarioForm, setEditUsuarioForm] = useState({})
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [mostrarSenhaEdit, setMostrarSenhaEdit] = useState(false)

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
    fetchConfig()
    fetchUsuarios()
    fetchSolicitacoes()
    fetchGrupos()
    fetchTiposNotion()
  }, [router])

  async function fetchTiposNotion() {
    try {
      const r = await fetch('/api/notion/tipos')
      if (r.ok) {
        const d = await r.json()
        setTiposNotion(d.tipos || [])
      }
    } catch {}
  }

  async function fetchFiliais() {
    const r = await fetch('/api/filiais')
    if (r.ok) setFiliais(await r.json())
  }

  async function fetchSolicitacoes() {
    setLoadingSolicitacoes(true)
    const r = await fetch('/api/solicitacoes')
    if (r.ok) setSolicitacoes(await r.json())
    setLoadingSolicitacoes(false)
  }

  async function fetchGrupos() {
    setLoadingGrupos(true)
    const r = await fetch('/api/grupos')
    if (r.ok) setGrupos(await r.json())
    setLoadingGrupos(false)
  }

  function showMsgGrupos(texto, tipo = 'success') {
    setMsgGrupos({ texto, tipo })
    setTimeout(() => setMsgGrupos({ texto: '', tipo: '' }), 3000)
  }

  async function salvarNovoGrupo() {
    if (!novoGrupo.nome.trim()) return
    setSalvandoGrupo(true)
    const r = await fetch('/api/grupos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoGrupo),
    })
    setSalvandoGrupo(false)
    if (r.ok) {
      setNovoGrupo({ nome: '', chat_id: '', descricao: '', alertas_notion_entrega: false, alertas_notion_ok: false, tipos_filtro_entrega: [], tipos_filtro_ok: [] })
      setMostraNovoGrupo(false)
      showMsgGrupos('Grupo adicionado!')
      fetchGrupos()
    } else {
      const d = await r.json().catch(() => ({}))
      showMsgGrupos('Erro: ' + (d.error || r.status), 'error')
    }
  }

  async function salvarEdicaoGrupo() {
    setSalvandoGrupo(true)
    const r = await fetch(`/api/grupos/${editandoGrupo}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editGrupoForm),
    })
    setSalvandoGrupo(false)
    if (r.ok) {
      setEditandoGrupo(null)
      showMsgGrupos('Grupo salvo!')
      fetchGrupos()
    } else {
      showMsgGrupos('Erro ao salvar', 'error')
    }
  }

  async function toggleGrupo(g, campo) {
    await fetch(`/api/grupos/${g.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [campo]: !g[campo] }),
    })
    fetchGrupos()
  }

  async function excluirGrupo(id, nome) {
    if (!confirm(`Excluir o grupo "${nome}"?`)) return
    await fetch(`/api/grupos/${id}`, { method: 'DELETE' })
    showMsgGrupos('Grupo removido.')
    fetchGrupos()
  }

  function showMsgSolicitacao(texto, tipo = 'success') {
    setMsgSolicitacao({ texto, tipo })
    setTimeout(() => setMsgSolicitacao({ texto: '', tipo: '' }), 3000)
  }

  async function salvarNovaSolicitacao() {
    if (!novaSolicitacao.nome.trim() || !novaSolicitacao.comando.trim() || !novaSolicitacao.chat_id.trim() || !novaSolicitacao.hora) return
    setSalvandoSolicitacao(true)
    const r = await fetch('/api/solicitacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novaSolicitacao),
    })
    setSalvandoSolicitacao(false)
    if (r.ok) {
      setNovaSolicitacao({ nome: '', comando: '', chat_id: '', hora: '17:00', dias_semana: 'seg,ter,qua,qui,sex' })
      setMostraNovaSolicitacao(false)
      showMsgSolicitacao('Solicitação criada com sucesso!')
      fetchSolicitacoes()
    } else {
      const d = await r.json().catch(() => ({}))
      showMsgSolicitacao('Erro: ' + (d.error || r.status), 'error')
    }
  }

  async function salvarEdicaoSolicitacao() {
    setSalvandoSolicitacao(true)
    const r = await fetch(`/api/solicitacoes/${editandoSolicitacao}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editSolicitacaoForm),
    })
    setSalvandoSolicitacao(false)
    if (r.ok) {
      setEditandoSolicitacao(null)
      showMsgSolicitacao('Solicitação atualizada!')
      fetchSolicitacoes()
    } else {
      showMsgSolicitacao('Erro ao salvar', 'error')
    }
  }

  async function toggleSolicitacaoAtivo(s) {
    await fetch(`/api/solicitacoes/${s.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...s, ativo: !s.ativo }),
    })
    fetchSolicitacoes()
  }

  async function excluirSolicitacao(id, nome) {
    if (!confirm(`Excluir a solicitação "${nome}"?`)) return
    await fetch(`/api/solicitacoes/${id}`, { method: 'DELETE' })
    showMsgSolicitacao('Solicitação removida.')
    fetchSolicitacoes()
  }

  async function executarAgora(s) {
    showMsgSolicitacao('Executando...', 'info')
    try {
      const r = await fetch('/api/solicitacoes/executar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id }),
      })
      const d = await r.json()
      if (r.ok) {
        showMsgSolicitacao(`"${s.nome}" executada com sucesso!`)
        fetchSolicitacoes()
      } else {
        showMsgSolicitacao('Erro: ' + (d.error || r.status), 'error')
      }
    } catch (e) {
      showMsgSolicitacao('Erro: ' + e.message, 'error')
    }
  }

  async function fetchConfig() {
    try {
      const r = await fetch('/api/config/notificacao-ok')
      if (r.ok) { const d = await r.json(); setGrupoNotifOk(d.grupo || '') }
    } catch {}
    try {
      const r = await fetch('/api/config/notificacao-entrega')
      if (r.ok) { const d = await r.json(); setGrupoNotifEntrega(d.grupo || '') }
    } catch {}
  }

  async function fetchUsuarios() {
    setLoadingUsuarios(true)
    try {
      const r = await fetch('/api/usuarios')
      if (r.ok) setUsuarios(await r.json())
    } catch {}
    setLoadingUsuarios(false)
  }

  async function salvarNotifOk() {
    setSalvandoNotifOk(true)
    try {
      const r = await fetch('/api/config/notificacao-ok', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupo: grupoNotifOk.trim() }),
      })
      const d = await r.json()
      if (r.ok) { setMsg('Grupo de notificação salvo!'); setTimeout(() => setMsg(''), 4000) }
      else setMsg('Erro: ' + (d.error || r.status))
    } catch (e) { setMsg('Erro: ' + e.message) }
    finally { setSalvandoNotifOk(false) }
  }

  async function salvarNotifEntrega() {
    setSalvandoNotifEntrega(true)
    try {
      const r = await fetch('/api/config/notificacao-entrega', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupo: grupoNotifEntrega.trim() }),
      })
      const d = await r.json()
      if (r.ok) { setMsg('Grupo de alerta de entrega salvo!'); setTimeout(() => setMsg(''), 4000) }
      else setMsg('Erro: ' + (d.error || r.status))
    } catch (e) { setMsg('Erro: ' + e.message) }
    finally { setSalvandoNotifEntrega(false) }
  }

  async function criarUsuario() {
    if (!novoUsuario.nome || !novoUsuario.email || !novoUsuario.senha) {
      setMsg('Preencha todos os campos')
      setTimeout(() => setMsg(''), 4000)
      return
    }
    setSalvandoUsuario(true)
    try {
      const r = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoUsuario),
      })
      const d = await r.json()
      if (r.ok) {
        setMsg('Usuário criado com sucesso!')
        setNovoUsuario({ nome: '', email: '', senha: '', role: 'colaborador' })
        setMostraNovoUsuario(false)
        setMostrarSenha(false)
        fetchUsuarios()
      } else {
        setMsg('Erro: ' + (d.error || r.status))
      }
    } catch (e) {
      setMsg('Erro: ' + e.message)
    }
    setSalvandoUsuario(false)
    setTimeout(() => setMsg(''), 4000)
  }

  async function salvarEdicaoUsuario() {
    setSalvandoUsuario(true)
    try {
      const payload = { ...editUsuarioForm }
      if (!payload.senha) delete payload.senha
      const r = await fetch(`/api/usuarios/${editandoUsuario}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (r.ok) {
        setMsg('Usuário atualizado!')
        setEditandoUsuario(null)
        setMostrarSenhaEdit(false)
        fetchUsuarios()
      } else {
        setMsg('Erro: ' + (d.error || r.status))
      }
    } catch (e) {
      setMsg('Erro: ' + e.message)
    }
    setSalvandoUsuario(false)
    setTimeout(() => setMsg(''), 4000)
  }

  async function desativarUsuario(u) {
    if (!confirm(`Desativar o usuário "${u.nome}"?`)) return
    await fetch(`/api/usuarios/${u.id}`, { method: 'DELETE' })
    setMsg('Usuário desativado.')
    setTimeout(() => setMsg(''), 4000)
    fetchUsuarios()
  }

  async function excluirFilial(id) {
    if (!confirm('Desativar esta filial?')) return
    setDeletingId(id)
    await fetch(`/api/filiais/${id}`, { method: 'DELETE' })
    setMsg('Filial desativada.')
    setDeletingId(null)
    fetchFiliais()
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar user={user} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">Administração</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-surface-raised rounded-lg p-1 w-fit">
          {[['filiais', 'Filiais'], ['usuarios', 'Usuários'], ['configuracoes', 'Configurações'], ['solicitacoes', 'Solicitações'], ['grupos', 'Grupos'], ['metricas', 'Métricas']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition ${tab === key ? 'bg-brand text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filiais */}
        {tab === 'filiais' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-gray-300 font-medium">Filiais cadastradas</h2>
              <Link
                href="/admin/filiais"
                className="bg-brand hover:bg-brand-dark text-white text-sm px-4 py-2 rounded-lg transition"
              >
                + Nova Filial
              </Link>
            </div>

            {msg && (
              <div className="mb-4 text-sm text-brand bg-green-900/20 border border-green-800 rounded-lg px-4 py-2">
                {msg}
              </div>
            )}

            {/* Filial cards */}
            <div className="space-y-3">
              {filiais.map(f => (
                <div key={f.id} className="bg-surface-raised rounded-xl border border-white/[0.06] px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium">{f.nome}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${f.ativo ? 'bg-green-900/40 text-brand' : 'bg-gray-800 text-gray-500'}`}>
                          {f.ativo ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                        <span>Workflow: {f.n8n_workflow_id || '—'}</span>
                        <span>Evolution: {f.evolution_instance || '—'}</span>
                        {f.group_chat_id && <span>Chat: {f.group_chat_id}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Link
                        href={`/admin/filiais/${f.id}`}
                        className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition"
                      >
                        Ver Detalhes
                      </Link>
                      <Link
                        href={`/admin/filiais/${f.id}`}
                        className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition"
                      >
                        Editar
                      </Link>
                      <button
                        onClick={() => excluirFilial(f.id)}
                        disabled={deletingId === f.id}
                        className="text-xs bg-red-900/40 hover:bg-red-800 disabled:opacity-50 text-red-400 px-3 py-1.5 rounded-lg transition"
                      >
                        {deletingId === f.id ? '...' : 'Remover'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filiais.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-sm mb-4">Nenhuma filial cadastrada.</p>
                  <Link
                    href="/admin/filiais"
                    className="bg-brand hover:bg-brand-dark text-white text-sm px-5 py-2 rounded-lg transition"
                  >
                    Criar primeira filial
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Usuários */}
        {tab === 'usuarios' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-gray-300 font-medium">Usuários do Dashboard</h2>
                <p className="text-gray-500 text-xs mt-1">Colaboradores acessam: Visão Geral, Chamados e Clientes</p>
              </div>
              <button
                onClick={() => { setMostraNovoUsuario(!mostraNovoUsuario); setMostrarSenha(false) }}
                className="bg-brand hover:bg-brand-dark text-white text-sm px-4 py-2 rounded-lg transition"
              >
                {mostraNovoUsuario ? 'Cancelar' : '+ Novo Usuário'}
              </button>
            </div>

            {msg && (
              <div className={`mb-4 text-sm rounded-lg px-4 py-2 border ${msg.startsWith('Erro') ? 'text-red-400 bg-red-900/20 border-red-800' : 'text-brand bg-green-900/20 border-green-800'}`}>
                {msg}
              </div>
            )}

            {/* Form novo usuário */}
            {mostraNovoUsuario && (
              <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-5 mb-4">
                <h3 className="text-white font-medium text-sm mb-4">Novo Usuário</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Nome</label>
                    <input
                      type="text"
                      value={novoUsuario.nome}
                      onChange={e => setNovoUsuario({ ...novoUsuario, nome: e.target.value })}
                      placeholder="Nome do colaborador"
                      className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:border-[#008000] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Email</label>
                    <input
                      type="email"
                      value={novoUsuario.email}
                      onChange={e => setNovoUsuario({ ...novoUsuario, email: e.target.value })}
                      placeholder="email@exemplo.com"
                      className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:border-[#008000] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Senha</label>
                    <div className="relative">
                      <input
                        type={mostrarSenha ? 'text' : 'password'}
                        value={novoUsuario.senha}
                        onChange={e => setNovoUsuario({ ...novoUsuario, senha: e.target.value })}
                        placeholder="Senha de acesso"
                        className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 pr-10 text-white text-sm placeholder-gray-600 focus:border-[#008000] focus:outline-none"
                      />
                      <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)} className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300">
                        {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Perfil</label>
                    <select
                      value={novoUsuario.role}
                      onChange={e => setNovoUsuario({ ...novoUsuario, role: e.target.value })}
                      className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#008000] focus:outline-none"
                    >
                      <option value="colaborador">Colaborador</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={criarUsuario}
                    disabled={salvandoUsuario}
                    className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-sm px-6 py-2 rounded-lg transition font-medium"
                  >
                    {salvandoUsuario ? 'Salvando...' : 'Criar Usuário'}
                  </button>
                </div>
              </div>
            )}

            {/* Lista de usuários */}
            <div className="space-y-3">
              {loadingUsuarios ? (
                <div className="text-center py-8 text-gray-500 text-sm">Carregando...</div>
              ) : usuarios.map(u => (
                <div key={u.id} className="bg-surface-raised rounded-xl border border-white/[0.06] px-5 py-4">
                  {editandoUsuario === u.id ? (
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Nome</label>
                          <input
                            type="text"
                            value={editUsuarioForm.nome || ''}
                            onChange={e => setEditUsuarioForm({ ...editUsuarioForm, nome: e.target.value })}
                            className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#008000] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Email</label>
                          <input
                            type="email"
                            value={editUsuarioForm.email || ''}
                            onChange={e => setEditUsuarioForm({ ...editUsuarioForm, email: e.target.value })}
                            className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#008000] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Nova Senha (deixe vazio para manter)</label>
                          <div className="relative">
                            <input
                              type={mostrarSenhaEdit ? 'text' : 'password'}
                              value={editUsuarioForm.senha || ''}
                              onChange={e => setEditUsuarioForm({ ...editUsuarioForm, senha: e.target.value })}
                              placeholder="Nova senha..."
                              className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 pr-10 text-white text-sm placeholder-gray-600 focus:border-[#008000] focus:outline-none"
                            />
                            <button type="button" onClick={() => setMostrarSenhaEdit(!mostrarSenhaEdit)} className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300">
                              {mostrarSenhaEdit ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Perfil</label>
                          <select
                            value={editUsuarioForm.role || 'colaborador'}
                            onChange={e => setEditUsuarioForm({ ...editUsuarioForm, role: e.target.value })}
                            className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#008000] focus:outline-none"
                          >
                            <option value="colaborador">Colaborador</option>
                            <option value="admin">Administrador</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mb-3">
                        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editUsuarioForm.ativo !== false}
                            onChange={e => setEditUsuarioForm({ ...editUsuarioForm, ativo: e.target.checked })}
                            className="rounded"
                          />
                          Ativo
                        </label>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setEditandoUsuario(null); setMostrarSenhaEdit(false) }}
                          className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg transition"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={salvarEdicaoUsuario}
                          disabled={salvandoUsuario}
                          className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-sm px-5 py-2 rounded-lg transition font-medium"
                        >
                          {salvandoUsuario ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-medium">{u.nome}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${u.role === 'admin' ? 'bg-green-900/40 text-brand' : 'bg-blue-900/40 text-blue-400'}`}>
                            {u.role === 'admin' ? 'Admin' : 'Colaborador'}
                          </span>
                          {!u.ativo && (
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-500">Inativo</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {u.email}
                          {u.criado_em && <span className="ml-3">Criado em: {new Date(u.criado_em).toLocaleDateString('pt-BR')}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setEditandoUsuario(u.id)
                            setEditUsuarioForm({ nome: u.nome, email: u.email, role: u.role, ativo: u.ativo, senha: '' })
                            setMostrarSenhaEdit(false)
                          }}
                          className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition"
                        >
                          Editar
                        </button>
                        {String(u.id) !== String(user?.id) && (
                          <button
                            onClick={() => desativarUsuario(u)}
                            className="text-xs bg-red-900/40 hover:bg-red-800 text-red-400 px-3 py-1.5 rounded-lg transition"
                          >
                            Desativar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {!loadingUsuarios && usuarios.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">Nenhum usuário cadastrado.</div>
              )}
            </div>
          </div>
        )}

        {/* Métricas */}
        {/* ── GRUPOS ─────────────────────────────────────────────────── */}
        {tab === 'grupos' && (
          <>
            {msgGrupos.texto && (
              <div className={`mb-4 text-sm px-4 py-2.5 rounded-lg border ${msgGrupos.tipo === 'error' ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-green-900/20 border-green-800 text-brand'}`}>
                {msgGrupos.texto}
              </div>
            )}

            <div className="bg-purple-900/20 border border-purple-800 rounded-xl px-5 py-3 mb-6 text-sm text-purple-300">
              <Users className="w-4 h-4 inline shrink-0 mr-1" />
              Grupos WhatsApp cadastrados. Configure quais recebem <strong>Alertas de Entrega</strong> e <strong>Notificações de OK</strong>.
              O chat_id é o JID do grupo (ex: <code className="bg-purple-900/40 px-1 rounded">120363...@g.us</code>).
            </div>

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-semibold">Grupos ({grupos.length})</h2>
              <button onClick={() => setMostraNovoGrupo(!mostraNovoGrupo)} className="bg-brand hover:bg-brand-dark text-white text-sm px-4 py-2 rounded-lg transition flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> {mostraNovoGrupo ? 'Cancelar' : 'Novo Grupo'}
              </button>
            </div>

            {mostraNovoGrupo && (
              <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-5 mb-6">
                <h3 className="text-white font-medium mb-4">Novo Grupo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Nome *</label>
                    <input value={novoGrupo.nome} onChange={e => setNovoGrupo(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Nego's Sub" className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-brand focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Chat ID (JID do grupo)</label>
                    <input value={novoGrupo.chat_id} onChange={e => setNovoGrupo(p => ({ ...p, chat_id: e.target.value }))} placeholder="120363xxxxx@g.us" className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-gray-600 focus:border-brand focus:outline-none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-gray-400 text-xs mb-1 block">Descrição</label>
                    <input value={novoGrupo.descricao} onChange={e => setNovoGrupo(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Grupo do designer" className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-brand focus:outline-none" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mb-4">
                  {[['alertas_notion_entrega','Alerta Entrega',Package],['alertas_notion_ok','Alerta OK',CheckCircle2]].map(([campo, label, Icon]) => (
                    <button key={campo} type="button" onClick={() => setNovoGrupo(p => ({ ...p, [campo]: !p[campo] }))}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${novoGrupo[campo] ? 'bg-brand border-brand text-white' : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      <Icon className="w-3.5 h-3.5" /> {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={salvarNovoGrupo} disabled={salvandoGrupo || !novoGrupo.nome.trim()} className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm transition">{salvandoGrupo ? 'Salvando...' : 'Criar Grupo'}</button>
                  <button onClick={() => setMostraNovoGrupo(false)} className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2 rounded-lg text-sm transition">Cancelar</button>
                </div>
              </div>
            )}

            {loadingGrupos ? (
              <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-surface-raised rounded-xl border border-white/[0.06] animate-pulse" />)}</div>
            ) : grupos.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhum grupo cadastrado.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {grupos.map(g => (
                  <div key={g.id} className="bg-surface-raised rounded-xl border border-white/[0.06] p-4">
                    {editandoGrupo === g.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div><label className="text-gray-400 text-xs mb-1 block">Nome</label><input value={editGrupoForm.nome || ''} onChange={e => setEditGrupoForm(p => ({ ...p, nome: e.target.value }))} className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-brand focus:outline-none" /></div>
                          <div><label className="text-gray-400 text-xs mb-1 block">Chat ID</label><input value={editGrupoForm.chat_id || ''} onChange={e => setEditGrupoForm(p => ({ ...p, chat_id: e.target.value }))} className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-brand focus:outline-none" /></div>
                          <div className="md:col-span-2"><label className="text-gray-400 text-xs mb-1 block">Descrição</label><input value={editGrupoForm.descricao || ''} onChange={e => setEditGrupoForm(p => ({ ...p, descricao: e.target.value }))} className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-brand focus:outline-none" /></div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {[['alertas_notion_entrega','Alerta Entrega',Package],['alertas_notion_ok','Alerta OK',CheckCircle2]].map(([campo, label, Icon]) => (
                            <button key={campo} type="button" onClick={() => setEditGrupoForm(p => ({ ...p, [campo]: !p[campo] }))}
                              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${editGrupoForm[campo] ? 'bg-brand border-brand text-white' : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                              <Icon className="w-3.5 h-3.5" /> {label}
                            </button>
                          ))}
                        </div>
                        {[['tipos_filtro_entrega','Tipos de tarefa que disparam alerta de Entrega'], ['tipos_filtro_ok','Tipos de tarefa que disparam alerta de OK']].map(([campo, label]) => {
                          const sel = editGrupoForm[campo] || []
                          return (
                            <div key={campo}>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-gray-400 text-xs">{label}</label>
                                <span className="text-gray-500 text-xs">{sel.length === 0 ? 'Todos os tipos' : `${sel.length} selecionados`}</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto bg-surface border border-gray-700 rounded-lg p-2">
                                {tiposNotion.map(t => {
                                  const on = sel.includes(t.name)
                                  return (
                                    <button key={t.name} type="button"
                                      onClick={() => setEditGrupoForm(p => ({
                                        ...p,
                                        [campo]: on ? sel.filter(x => x !== t.name) : [...sel, t.name]
                                      }))}
                                      className={`text-xs px-2 py-0.5 rounded-md border transition ${on ? 'bg-brand/20 border-brand text-brand' : 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-500'}`}>
                                      {t.name}
                                    </button>
                                  )
                                })}
                                {tiposNotion.length === 0 && <span className="text-gray-600 text-xs">Carregando tipos do Notion...</span>}
                              </div>
                              <p className="text-gray-600 text-[11px] mt-1">Vazio = recebe alertas de qualquer tipo. Selecione tipos para filtrar.</p>
                            </div>
                          )
                        })}
                        <div className="flex gap-2">
                          <button onClick={salvarEdicaoGrupo} disabled={salvandoGrupo} className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm transition">{salvandoGrupo ? 'Salvando...' : 'Salvar'}</button>
                          <button onClick={() => setEditandoGrupo(null)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg text-sm transition">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${g.ativo ? 'bg-green-400' : 'bg-gray-600'}`} />
                            <span className="text-white font-medium text-sm">{g.nome}</span>
                            {g.descricao && <span className="text-gray-500 text-xs">{g.descricao}</span>}
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-2">
                            <code className="text-xs font-mono text-gray-500 bg-gray-800/60 px-2 py-0.5 rounded max-w-xs truncate block">
                              {g.chat_id || <span className="text-yellow-600 italic">chat_id não configurado</span>}
                            </code>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {[['alertas_notion_entrega','Entrega',Package,'tipos_filtro_entrega'],['alertas_notion_ok','OK',CheckCircle2,'tipos_filtro_ok']].map(([campo, label, Icon, tcampo]) => {
                              const tipos = g[tcampo] || []
                              const ativo = g[campo]
                              const tipoLabel = !ativo ? '' : (tipos.length === 0 ? 'todos' : `${tipos.length} tipo${tipos.length>1?'s':''}`)
                              return (
                                <button key={campo} onClick={() => toggleGrupo(g, campo)}
                                  className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition ${ativo ? 'bg-brand/20 border-green-700 text-brand' : 'bg-transparent border-gray-700 text-gray-600 hover:border-gray-500'}`}>
                                  <Icon className="w-3 h-3" /> {label}{tipoLabel && <span className="opacity-70 ml-0.5">· {tipoLabel}</span>}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => { setEditandoGrupo(g.id); setEditGrupoForm({ nome: g.nome, chat_id: g.chat_id, descricao: g.descricao, alertas_notion_entrega: g.alertas_notion_entrega, alertas_notion_ok: g.alertas_notion_ok, tipos_filtro_entrega: g.tipos_filtro_entrega || [], tipos_filtro_ok: g.tipos_filtro_ok || [] }) }} className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition">Editar</button>
                          <button onClick={() => excluirGrupo(g.id, g.nome)} className="text-xs text-red-400 bg-red-900/20 hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition">Excluir</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'metricas' && <MetricasTab />}


        {/* Configurações */}
        {tab === 'configuracoes' && (
          <div>
            <h2 className="text-gray-300 font-medium mb-4">Configurações do Bot</h2>

            {msg && (
              <div className="mb-4 text-sm text-brand bg-green-900/20 border border-green-800 rounded-lg px-4 py-2">
                {msg}
              </div>
            )}

            <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-5">
              <div className="mb-1">
                <label className="text-white font-medium text-sm">Grupo de Notificação — Tarefa Concluída (Ok)</label>
                <p className="text-gray-500 text-xs mt-0.5 mb-3">
                  Quando uma tarefa for marcada como Ok no Notion, o bot envia um aviso neste grupo. Deixe vazio para desativar. Formato: numero@g.us
                </p>
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={grupoNotifOk}
                  onChange={e => setGrupoNotifOk(e.target.value)}
                  placeholder="554384924456-1616013394@g.us (vazio = desativado)"
                  className="flex-1 bg-surface border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:border-[#008000] focus:outline-none transition"
                />
                <button
                  onClick={salvarNotifOk}
                  disabled={salvandoNotifOk}
                  className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-sm px-6 py-2.5 rounded-lg transition font-medium shrink-0"
                >
                  {salvandoNotifOk ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>

            <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-5 mt-4">
              <div className="mb-1">
                <label className="text-white font-medium text-sm">Grupo de Notificação — Alerta de Entrega</label>
                <p className="text-gray-500 text-xs mt-0.5 mb-3">
                  Quando uma tarefa chegar na data de entrega e ainda estiver pendente, o bot envia um aviso neste grupo. Deixe vazio para desativar. Formato: numero@g.us
                </p>
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={grupoNotifEntrega}
                  onChange={e => setGrupoNotifEntrega(e.target.value)}
                  placeholder="554384924456-1616013394@g.us (vazio = desativado)"
                  className="flex-1 bg-surface border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:border-[#008000] focus:outline-none transition"
                />
                <button
                  onClick={salvarNotifEntrega}
                  disabled={salvandoNotifEntrega}
                  className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-sm px-6 py-2.5 rounded-lg transition font-medium shrink-0"
                >
                  {salvandoNotifEntrega ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Solicitações */}
        {tab === 'solicitacoes' && (
          <>
            {msgSolicitacao.texto && (
              <div className={`mb-4 text-sm px-4 py-2.5 rounded-lg border ${msgSolicitacao.tipo === 'error' ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-green-900/20 border-green-800 text-brand'}`}>
                {msgSolicitacao.texto}
              </div>
            )}

            <div className="bg-blue-900/20 border border-blue-800 rounded-xl px-5 py-3 mb-6 text-sm text-blue-300">
              <Clock className="w-4 h-4 inline shrink-0 mr-1" />
              Solicitações Programadas executam comandos automaticamente no horário definido — sem precisar digitar no WhatsApp.
              Exemplo: <code className="bg-blue-900/40 px-1 rounded">/relatorio chamados</code> todo dia às 17:00.
            </div>

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-semibold">Agendamentos ({solicitacoes.length})</h2>
              <button
                onClick={() => setMostraNovaSolicitacao(!mostraNovaSolicitacao)}
                className="bg-brand hover:bg-brand-dark text-white text-sm px-4 py-2 rounded-lg transition"
              >
                {mostraNovaSolicitacao ? 'Cancelar' : '+ Nova Solicitação'}
              </button>
            </div>

            {mostraNovaSolicitacao && (
              <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-5 mb-6">
                <h3 className="text-white font-medium mb-4">Nova Solicitação Programada</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Nome *</label>
                    <input placeholder="Ex: Relatório Diário de Chamados" value={novaSolicitacao.nome} onChange={e => setNovaSolicitacao(p => ({ ...p, nome: e.target.value }))} className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:border-brand focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Comando * (igual ao que você digitaria no WhatsApp)</label>
                    <input placeholder="Ex: /relatorio chamados" value={novaSolicitacao.comando} onChange={e => setNovaSolicitacao(p => ({ ...p, comando: e.target.value }))} className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:border-brand focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Horário *</label>
                    <input type="time" value={novaSolicitacao.hora} onChange={e => setNovaSolicitacao(p => ({ ...p, hora: e.target.value }))} className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-brand focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">
                      Grupos *
                      {novaSolicitacao.chat_id && <span className="text-brand ml-2">{novaSolicitacao.chat_id.split(',').filter(Boolean).length} selecionado(s)</span>}
                    </label>
                    {grupos.filter(g => g.chat_id).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {grupos.filter(g => g.chat_id).map(g => {
                          const sel = novaSolicitacao.chat_id.split(',').filter(Boolean).includes(g.chat_id)
                          return (
                            <button key={g.id} type="button"
                              onClick={() => {
                                const ids = new Set(novaSolicitacao.chat_id.split(',').filter(Boolean))
                                if (ids.has(g.chat_id)) ids.delete(g.chat_id)
                                else ids.add(g.chat_id)
                                setNovaSolicitacao(p => ({ ...p, chat_id: [...ids].join(',') }))
                              }}
                              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${sel ? 'bg-brand border-brand text-white' : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                              <Users className="w-3 h-3" /> {g.nome}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <input placeholder="120363xxxxx@g.us" value={novaSolicitacao.chat_id} onChange={e => setNovaSolicitacao(p => ({ ...p, chat_id: e.target.value }))} className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-gray-600 focus:border-brand focus:outline-none" />
                    )}
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Dias da Semana</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[['todos','Todos'],['seg','Seg'],['ter','Ter'],['qua','Qua'],['qui','Qui'],['sex','Sex'],['sab','Sáb'],['dom','Dom']].map(([val, label]) => {
                        const isChecked = val === 'todos' ? novaSolicitacao.dias_semana === 'todos' : novaSolicitacao.dias_semana !== 'todos' && novaSolicitacao.dias_semana.split(',').includes(val)
                        return (
                          <button key={val} type="button" onClick={() => {
                            if (val === 'todos') { setNovaSolicitacao(p => ({ ...p, dias_semana: 'todos' })) }
                            else { const atual = novaSolicitacao.dias_semana === 'todos' ? [] : novaSolicitacao.dias_semana.split(',').filter(Boolean); const novo = isChecked ? atual.filter(d => d !== val) : [...atual, val]; setNovaSolicitacao(p => ({ ...p, dias_semana: novo.length ? novo.join(',') : 'seg' })) }
                          }} className={`text-xs px-3 py-1.5 rounded-lg transition border ${isChecked ? 'bg-brand border-green-700 text-white' : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'}`}>{label}</button>
                        )
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={salvarNovaSolicitacao} disabled={salvandoSolicitacao} className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm transition">{salvandoSolicitacao ? 'Salvando...' : 'Salvar'}</button>
                  <button onClick={() => setMostraNovaSolicitacao(false)} className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2 rounded-lg text-sm transition">Cancelar</button>
                </div>
              </div>
            )}

            {loadingSolicitacoes ? (
              <p className="text-gray-500 text-sm">Carregando...</p>
            ) : solicitacoes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhuma solicitação programada.</p>
                <p className="text-xs mt-1">Clique em "+ Nova Solicitação" para começar.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {solicitacoes.map(s => (
                  <div key={s.id} className="bg-surface-raised rounded-xl border border-white/[0.06] p-4">
                    {editandoSolicitacao === s.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-gray-400 text-xs mb-1 block">Nome</label><input value={editSolicitacaoForm.nome || ''} onChange={e => setEditSolicitacaoForm(p => ({ ...p, nome: e.target.value }))} className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-brand focus:outline-none" /></div>
                          <div><label className="text-gray-400 text-xs mb-1 block">Comando</label><input value={editSolicitacaoForm.comando || ''} onChange={e => setEditSolicitacaoForm(p => ({ ...p, comando: e.target.value }))} className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-brand focus:outline-none" /></div>
                          <div><label className="text-gray-400 text-xs mb-1 block">Horário</label><input type="time" value={editSolicitacaoForm.hora || ''} onChange={e => setEditSolicitacaoForm(p => ({ ...p, hora: e.target.value }))} className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-brand focus:outline-none" /></div>
                          <div className="col-span-2">
                            <label className="text-gray-400 text-xs mb-1 block">
                              Grupos
                              {editSolicitacaoForm.chat_id && <span className="text-brand ml-2">{(editSolicitacaoForm.chat_id || '').split(',').filter(Boolean).length} selecionado(s)</span>}
                            </label>
                            {grupos.filter(g => g.chat_id).length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {grupos.filter(g => g.chat_id).map(g => {
                                  const sel = (editSolicitacaoForm.chat_id || '').split(',').filter(Boolean).includes(g.chat_id)
                                  return (
                                    <button key={g.id} type="button"
                                      onClick={() => {
                                        const ids = new Set((editSolicitacaoForm.chat_id || '').split(',').filter(Boolean))
                                        if (ids.has(g.chat_id)) ids.delete(g.chat_id)
                                        else ids.add(g.chat_id)
                                        setEditSolicitacaoForm(p => ({ ...p, chat_id: [...ids].join(',') }))
                                      }}
                                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${sel ? 'bg-brand border-brand text-white' : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                                      <Users className="w-3 h-3" /> {g.nome}
                                    </button>
                                  )
                                })}
                              </div>
                            ) : (
                              <input value={editSolicitacaoForm.chat_id || ''} onChange={e => setEditSolicitacaoForm(p => ({ ...p, chat_id: e.target.value }))} className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-brand focus:outline-none" />
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Dias da Semana</label>
                          <div className="flex flex-wrap gap-2">
                            {[['todos','Todos'],['seg','Seg'],['ter','Ter'],['qua','Qua'],['qui','Qui'],['sex','Sex'],['sab','Sáb'],['dom','Dom']].map(([val, label]) => {
                              const isChecked = val === 'todos' ? editSolicitacaoForm.dias_semana === 'todos' : editSolicitacaoForm.dias_semana !== 'todos' && (editSolicitacaoForm.dias_semana || '').split(',').includes(val)
                              return (
                                <button key={val} type="button" onClick={() => {
                                  if (val === 'todos') { setEditSolicitacaoForm(p => ({ ...p, dias_semana: 'todos' })) }
                                  else { const atual = editSolicitacaoForm.dias_semana === 'todos' ? [] : (editSolicitacaoForm.dias_semana || '').split(',').filter(Boolean); const novo = isChecked ? atual.filter(d => d !== val) : [...atual, val]; setEditSolicitacaoForm(p => ({ ...p, dias_semana: novo.length ? novo.join(',') : 'seg' })) }
                                }} className={`text-xs px-3 py-1.5 rounded-lg transition border ${isChecked ? 'bg-brand border-green-700 text-white' : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'}`}>{label}</button>
                              )
                            })}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={salvarEdicaoSolicitacao} disabled={salvandoSolicitacao} className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm transition">{salvandoSolicitacao ? 'Salvando...' : 'Salvar'}</button>
                          <button onClick={() => setEditandoSolicitacao(null)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg text-sm transition">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${s.ativo ? 'bg-green-400' : 'bg-gray-600'}`} />
                            <span className="text-white font-medium text-sm">{s.nome}</span>
                            <code className="text-xs bg-gray-800 text-blue-300 px-2 py-0.5 rounded">{s.comando}</code>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-gray-400 text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> {s.hora}</span>
                            <span className="text-gray-500 text-xs">{s.dias_semana === 'todos' ? 'Todos os dias' : s.dias_semana.replace(/,/g, ' · ')}</span>
                            {s.chat_id && <span className="text-gray-500 text-xs flex items-center gap-1"><Users className="w-3 h-3" />{s.chat_id.split(',').filter(Boolean).map(cid => grupos.find(g => g.chat_id === cid)?.nome || cid).join(', ')}</span>}
                            {s.ultimo_executado && <span className="text-gray-600 text-xs">Última execução: {new Date(s.ultimo_executado).toLocaleString('pt-BR')}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => executarAgora(s)} className="text-xs text-blue-400 bg-blue-900/20 hover:bg-blue-900/40 px-3 py-1.5 rounded-lg transition">Executar Agora</button>
                          <button onClick={() => toggleSolicitacaoAtivo(s)} className={`text-xs px-3 py-1.5 rounded-lg transition ${s.ativo ? 'bg-green-900/30 text-brand hover:bg-brand/15' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{s.ativo ? 'Ativo' : 'Inativo'}</button>
                          <button onClick={() => { setEditandoSolicitacao(s.id); setEditSolicitacaoForm({ nome: s.nome, comando: s.comando, chat_id: s.chat_id, hora: s.hora, dias_semana: s.dias_semana, ativo: s.ativo }) }} className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition">Editar</button>
                          <button onClick={() => excluirSolicitacao(s.id, s.nome)} className="text-xs text-red-400 bg-red-900/20 hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition">Excluir</button>
                        </div>
                      </div>
                    )}
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
