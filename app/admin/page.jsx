'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

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
  const [grupoId, setGrupoId] = useState('')
  const [salvandoGrupo, setSalvandoGrupo] = useState(false)
  const [grupoNotifOk, setGrupoNotifOk] = useState('')
  const [salvandoNotifOk, setSalvandoNotifOk] = useState(false)
  const [grupoNotifEntrega, setGrupoNotifEntrega] = useState('')
  const [salvandoNotifEntrega, setSalvandoNotifEntrega] = useState(false)

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
  }, [router])

  async function fetchFiliais() {
    const r = await fetch('/api/filiais')
    if (r.ok) setFiliais(await r.json())
  }

  async function fetchConfig() {
    try {
      const r = await fetch('/api/config/bom-dia')
      if (r.ok) { const d = await r.json(); setGrupoId(d.grupo || '') }
    } catch {}
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

  async function salvarGrupo() {
    if (!grupoId.trim()) return
    setSalvandoGrupo(true)
    try {
      const r = await fetch('/api/config/bom-dia', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupo: grupoId.trim() }),
      })
      const d = await r.json()
      if (r.ok) {
        setMsg('Grupo do Bom Dia salvo com sucesso!')
        setTimeout(() => setMsg(''), 4000)
      } else {
        setMsg('Erro: ' + (d.error || r.status))
      }
    } catch (e) {
      setMsg('Erro: ' + e.message)
    } finally {
      setSalvandoGrupo(false)
    }
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
          {[['filiais', 'Filiais'], ['usuarios', 'Usuários'], ['configuracoes', 'Configurações'], ['metricas', 'Métricas']].map(([key, label]) => (
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
                <label className="text-white font-medium text-sm">Grupo do Bom Dia (WhatsApp)</label>
                <p className="text-gray-500 text-xs mt-0.5 mb-3">
                  ID do grupo que recebe a mensagem de bom dia. Formato: numero@g.us (ex: 554384924456-1616013394@g.us)
                </p>
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={grupoId}
                  onChange={e => setGrupoId(e.target.value)}
                  placeholder="554384924456-1616013394@g.us"
                  className="flex-1 bg-surface border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:border-[#008000] focus:outline-none transition"
                />
                <button
                  onClick={salvarGrupo}
                  disabled={salvandoGrupo || !grupoId.trim()}
                  className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-sm px-6 py-2.5 rounded-lg transition font-medium shrink-0"
                >
                  {salvandoGrupo ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <p className="text-xs text-gray-500">
                  Para encontrar o ID do grupo: abra a Evolution API ou verifique nos logs do webhook. O ID sempre termina com @g.us
                </p>
              </div>
            </div>

            <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-5 mt-4">
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
      </main>
    </div>
  )
}
