'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { Brain, Lightbulb, BotMessageSquare, Users, ClipboardList, FileText, ChevronDown, Zap, Clock, BookOpen, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

const CATEGORIAS = ['Geral', 'Atendimento', 'Técnico', 'Financeiro', 'Comercial', 'RH', 'Outro']

export default function TreinamentoPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('regras')

  // ===== REGRAS =====
  const [regras, setRegras] = useState([])
  const [loadingRegras, setLoadingRegras] = useState(true)
  const [novaRegra, setNovaRegra] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [editandoTexto, setEditandoTexto] = useState('')
  const [msg, setMsg] = useState({ texto: '', tipo: '' })
  const [salvando, setSalvando] = useState(false)

  // ===== COLABORADORES =====
  const [colaboradores, setColaboradores] = useState([])
  const [novoColab, setNovoColab] = useState({ nome: '', cargo: '', funcoes: '', telefone_whatsapp: '' })
  const [editandoColab, setEditandoColab] = useState(null)
  const [editColabForm, setEditColabForm] = useState({})
  const [msgColab, setMsgColab] = useState({ texto: '', tipo: '' })

  // ===== SOLICITAÇÕES PROGRAMADAS =====
  const [solicitacoes, setSolicitacoes] = useState([])
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(true)
  const [novaSolicitacao, setNovaSolicitacao] = useState({ nome: '', comando: '', chat_id: '554384924456-1616013394@g.us', hora: '17:00', dias_semana: 'seg,ter,qua,qui,sex' })
  const [mostraNovaSolicitacao, setMostraNovaSolicitacao] = useState(false)
  const [editandoSolicitacao, setEditandoSolicitacao] = useState(null)
  const [editSolicitacaoForm, setEditSolicitacaoForm] = useState({})
  const [msgSolicitacao, setMsgSolicitacao] = useState({ texto: '', tipo: '' })
  const [salvandoSolicitacao, setSalvandoSolicitacao] = useState(false)

  // ===== SKILLS =====
  const [skills, setSkills] = useState([])
  const [loadingSkills, setLoadingSkills] = useState(true)
  const [novaSkill, setNovaSkill] = useState({ nome: '', descricao: '', prompt_base: '', parametros_opcionais: '[]' })
  const [mostraNovaSkill, setMostraNovaSkill] = useState(false)
  const [editandoSkill, setEditandoSkill] = useState(null)
  const [editSkillForm, setEditSkillForm] = useState({})
  const [msgSkill, setMsgSkill] = useState({ texto: '', tipo: '' })
  const [salvandoSkill, setSalvandoSkill] = useState(false)

  // ===== POPs =====
  const [pops, setPops] = useState([])
  const [loadingPops, setLoadingPops] = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [editandoPop, setEditandoPop] = useState(null)
  const [editPopForm, setEditPopForm] = useState({})
  const [novoPopForm, setNovoPopForm] = useState({ titulo: '', categoria: 'Geral', conteudo: '', prioridade: 'relevante' })
  const [mostraNovoPop, setMostraNovoPop] = useState(false)
  const [buscaPop, setBuscaPop] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas')
  const [msgPop, setMsgPop] = useState({ texto: '', tipo: '' })
  const [salvandoPop, setSalvandoPop] = useState(false)

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
    fetchColaboradores()
    fetchPops()
    fetchSkills()
    fetchSolicitacoes()
  }, [router])

  // ===== REGRAS FUNCS =====
  async function fetchRegras() {
    setLoadingRegras(true)
    const r = await fetch('/api/treinamento')
    if (r.ok) setRegras(await r.json())
    setLoadingRegras(false)
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
    if (r.ok) { showMsg('Regra removida.'); fetchRegras() }
    else showMsg('Erro ao excluir', 'error')
  }

  // ===== COLABORADORES FUNCS =====
  async function fetchColaboradores() {
    const r = await fetch('/api/colaboradores')
    if (r.ok) setColaboradores(await r.json())
  }

  function showMsgColab(texto, tipo = 'success') {
    setMsgColab({ texto, tipo })
    setTimeout(() => setMsgColab({ texto: '', tipo: '' }), 3000)
  }

  async function adicionarColab() {
    if (!novoColab.nome.trim()) return
    const r = await fetch('/api/colaboradores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoColab),
    })
    if (r.ok) {
      setNovoColab({ nome: '', cargo: '', funcoes: '', telefone_whatsapp: '' })
      showMsgColab('Colaborador adicionado!')
      fetchColaboradores()
    } else {
      const d = await r.json().catch(() => ({}))
      showMsgColab('Erro: ' + (d.error || r.status), 'error')
    }
  }

  async function salvarColab(id) {
    const r = await fetch(`/api/colaboradores/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editColabForm),
    })
    if (r.ok) { setEditandoColab(null); showMsgColab('Atualizado!'); fetchColaboradores() }
    else showMsgColab('Erro ao salvar', 'error')
  }

  async function excluirColab(id, nome) {
    if (!confirm(`Remover ${nome}?`)) return
    await fetch(`/api/colaboradores/${id}`, { method: 'DELETE' })
    fetchColaboradores()
  }

  // ===== POPs FUNCS =====
  async function fetchPops() {
    setLoadingPops(true)
    const r = await fetch('/api/pops')
    if (r.ok) setPops(await r.json())
    setLoadingPops(false)
  }

  function showMsgPop(texto, tipo = 'success') {
    setMsgPop({ texto, tipo })
    setTimeout(() => setMsgPop({ texto: '', tipo: '' }), 3000)
  }

  async function salvarNovoPop() {
    if (!novoPopForm.titulo.trim() || !novoPopForm.conteudo.trim()) return
    setSalvandoPop(true)
    const r = await fetch('/api/pops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoPopForm),
    })
    setSalvandoPop(false)
    if (r.ok) {
      setNovoPopForm({ titulo: '', categoria: 'Geral', conteudo: '', prioridade: 'relevante' })
      setMostraNovoPop(false)
      showMsgPop('POP adicionado com sucesso!')
      fetchPops()
    } else {
      const d = await r.json().catch(() => ({}))
      showMsgPop('Erro: ' + (d.error || r.status), 'error')
    }
  }

  async function salvarEdicaoPop() {
    setSalvandoPop(true)
    const r = await fetch(`/api/pops/${editandoPop}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editPopForm),
    })
    setSalvandoPop(false)
    if (r.ok) {
      setEditandoPop(null)
      showMsgPop('POP atualizado!')
      fetchPops()
    } else {
      showMsgPop('Erro ao salvar', 'error')
    }
  }

  async function excluirPop(id, titulo) {
    if (!confirm(`Arquivar "${titulo}"?`)) return
    await fetch(`/api/pops/${id}`, { method: 'DELETE' })
    showMsgPop('POP arquivado.')
    fetchPops()
  }

  // ===== SOLICITAÇÕES FUNCS =====
  async function fetchSolicitacoes() {
    setLoadingSolicitacoes(true)
    const r = await fetch('/api/solicitacoes')
    if (r.ok) setSolicitacoes(await r.json())
    setLoadingSolicitacoes(false)
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
      setNovaSolicitacao({ nome: '', comando: '', chat_id: '554384924456-1616013394@g.us', hora: '17:00', dias_semana: 'seg,ter,qua,qui,sex' })
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

  // ===== SKILLS FUNCS =====
  async function fetchSkills() {
    setLoadingSkills(true)
    const r = await fetch('/api/skills')
    if (r.ok) setSkills(await r.json())
    setLoadingSkills(false)
  }

  function showMsgSkill(texto, tipo = 'success') {
    setMsgSkill({ texto, tipo })
    setTimeout(() => setMsgSkill({ texto: '', tipo: '' }), 3000)
  }

  async function salvarNovaSkill() {
    if (!novaSkill.nome.trim() || !novaSkill.prompt_base.trim()) return
    setSalvandoSkill(true)
    const r = await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novaSkill),
    })
    setSalvandoSkill(false)
    if (r.ok) {
      setNovaSkill({ nome: '', descricao: '', prompt_base: '', parametros_opcionais: '[]' })
      setMostraNovaSkill(false)
      showMsgSkill('Skill adicionada com sucesso!')
      fetchSkills()
    } else {
      const d = await r.json().catch(() => ({}))
      showMsgSkill('Erro: ' + (d.error || r.status), 'error')
    }
  }

  async function salvarEdicaoSkill() {
    setSalvandoSkill(true)
    const r = await fetch(`/api/skills/${editandoSkill}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editSkillForm),
    })
    setSalvandoSkill(false)
    if (r.ok) {
      setEditandoSkill(null)
      showMsgSkill('Skill atualizada!')
      fetchSkills()
    } else {
      const d = await r.json().catch(() => ({}))
      showMsgSkill('Erro: ' + (d.error || r.status), 'error')
    }
  }

  async function toggleSkillAtivo(sk) {
    await fetch(`/api/skills/${sk.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sk, parametros_opcionais: JSON.stringify(sk.parametros_opcionais || []), ativo: !sk.ativo }),
    })
    fetchSkills()
  }

  async function excluirSkill(id, nome) {
    if (!confirm(`Excluir a skill "${nome}"?`)) return
    await fetch(`/api/skills/${id}`, { method: 'DELETE' })
    showMsgSkill('Skill removida.')
    fetchSkills()
  }

  const categorias = ['Todas', ...new Set(pops.map(p => p.categoria).filter(Boolean))]
  const popsFiltrados = pops.filter(p => {
    const matchBusca = !buscaPop || p.titulo.toLowerCase().includes(buscaPop.toLowerCase()) || p.conteudo.toLowerCase().includes(buscaPop.toLowerCase())
    const matchCat = categoriaFiltro === 'Todas' || p.categoria === categoriaFiltro
    return matchBusca && matchCat
  })

  const inputCls = 'w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#008000] transition'
  const inputEditCls = 'w-full bg-surface border border-[#008000] rounded-lg px-3 py-2 text-white text-sm focus:outline-none transition'

  const tabs = [
    { id: 'regras', label: <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> Regras</span>, count: regras.length },
    { id: 'pops', label: <span className="flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" /> POPs</span>, count: pops.length },
    { id: 'colaboradores', label: <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Colaboradores</span>, count: colaboradores.length },
    { id: 'skills', label: <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> Skills</span>, count: skills.length },
    { id: 'solicitacoes', label: <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Solicitações</span>, count: solicitacoes.length },
    ...(user?.role === 'admin' ? [{ id: 'evolutivo', label: <span className="flex items-center gap-1"><Brain className="w-3.5 h-3.5" /> Evolutivo</span>, count: null }] : []),
  ]

  return (
    <div className="min-h-screen bg-surface">
      <Navbar user={user} />
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Treinamento & POPs</h1>
          <p className="text-gray-400 text-sm mt-1">Regras, procedimentos e equipe do Maluco da IA</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-surface-raised p-1 rounded-xl border border-white/[0.06] w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-brand text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {t.label}
              {t.count !== null && (
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  tab === t.id ? 'bg-green-700' : 'bg-gray-800'
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ==================== ABA REGRAS ==================== */}
        {tab === 'regras' && (
          <>
            <div className="bg-green-900/20 border border-green-800 rounded-xl px-5 py-3 mb-6 text-sm text-brand-light">
              <Lightbulb className="w-4 h-4 inline shrink-0" /> Essas regras são aplicadas em <strong>todas</strong> as respostas do bot. Os colaboradores também podem ensinar via WhatsApp com <code className="bg-green-900/40 px-1 rounded">Claude aprenda: ...</code>
            </div>

            {msg.texto && (
              <div className={`mb-4 text-sm px-4 py-2.5 rounded-lg border ${msg.tipo === 'error' ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-green-900/20 border-green-800 text-brand'}`}>
                {msg.texto}
              </div>
            )}

            {/* Adicionar nova regra */}
            <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-5 mb-6">
              <h2 className="text-white font-medium mb-3">+ Adicionar nova regra</h2>
              <textarea
                value={novaRegra}
                onChange={e => setNovaRegra(e.target.value)}
                placeholder="Ex: Sempre responda em português formal. Nunca mencione preços sem consultar a tabela oficial."
                rows={3}
                className="w-full bg-surface border border-gray-700 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#008000] resize-none transition"
              />
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-gray-500">{novaRegra.length} caracteres</span>
                <button
                  onClick={adicionarRegra}
                  disabled={!novaRegra.trim() || salvando}
                  className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-sm px-5 py-2 rounded-lg transition font-medium"
                >
                  {salvando ? 'Salvando...' : 'Adicionar Regra'}
                </button>
              </div>
            </div>

            {/* Lista de regras */}
            <div className="bg-surface-raised rounded-xl border border-white/[0.06]">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <h2 className="text-white font-medium">Regras ativas</h2>
              </div>
              {loadingRegras ? (
                <div className="p-8 text-center text-gray-500">Carregando...</div>
              ) : regras.length === 0 ? (
                <div className="p-10 text-center">
                  <BotMessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Nenhuma regra cadastrada ainda.</p>
                  <p className="text-gray-600 text-sm mt-1">Adicione regras para personalizar o comportamento do bot.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800/60">
                  {regras.map((r, i) => (
                    <div key={r.id} className="px-5 py-4 group">
                      {editandoId === r.id ? (
                        <div>
                          <div className="text-xs text-brand mb-2 font-medium">Editando regra #{i + 1}</div>
                          <textarea
                            value={editandoTexto}
                            onChange={e => setEditandoTexto(e.target.value)}
                            rows={3}
                            className="w-full bg-surface border border-[#008000] rounded-lg px-4 py-3 text-white text-sm focus:outline-none resize-none"
                            autoFocus
                          />
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => salvarEdicao(r.id)} disabled={salvando}
                              className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-xs px-4 py-1.5 rounded-lg transition">
                              {salvando ? 'Salvando...' : 'Salvar'}
                            </button>
                            <button onClick={() => setEditandoId(null)}
                              className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-4 py-1.5 rounded-lg transition">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-4">
                          <span className="text-xs text-gray-600 font-mono mt-0.5 w-6 text-right shrink-0">{i + 1}</span>
                          <p className="text-gray-200 text-sm flex-1 leading-relaxed whitespace-pre-wrap">{r.regra}</p>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                            <button onClick={() => { setEditandoId(r.id); setEditandoTexto(r.regra) }}
                              className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition">
                              Editar
                            </button>
                            <button onClick={() => excluirRegra(r.id, r.regra)}
                              className="text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition">
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
          </>
        )}

        {/* ==================== ABA POPs ==================== */}
        {tab === 'pops' && (
          <>
            {msgPop.texto && (
              <div className={`mb-4 text-sm px-4 py-2.5 rounded-lg border ${msgPop.tipo === 'error' ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-green-900/20 border-green-800 text-brand'}`}>
                {msgPop.texto}
              </div>
            )}

            {/* Header + botão novo */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400 text-sm">Procedimentos Operacionais Padrão da empresa</p>
              <button
                onClick={() => { setMostraNovoPop(true); setExpandido(null); setEditandoPop(null) }}
                className="bg-brand hover:bg-brand-dark text-white text-sm px-4 py-2 rounded-lg transition font-medium"
              >
                + Novo POP
              </button>
            </div>

            {/* Formulário novo POP */}
            {mostraNovoPop && (
              <div className="bg-surface-raised rounded-xl border border-brand/20 p-6 mb-6">
                <h2 className="text-white font-medium mb-4">Novo POP</h2>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Título *</label>
                    <input value={novoPopForm.titulo} onChange={e => setNovoPopForm({...novoPopForm, titulo: e.target.value})}
                      placeholder="Ex: Como realizar ordem de serviço" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Categoria</label>
                    <select value={novoPopForm.categoria} onChange={e => setNovoPopForm({...novoPopForm, categoria: e.target.value})}
                      className={inputCls}>
                      {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Prioridade</label>
                    <select value={novoPopForm.prioridade} onChange={e => setNovoPopForm({...novoPopForm, prioridade: e.target.value})}
                      className={inputCls}>
                      <option value="sempre">Leia Sempre</option>
                      <option value="importante">Importante</option>
                      <option value="relevante">Relevante</option>
                    </select>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-xs text-gray-400 mb-1">Conteúdo *</label>
                  <textarea
                    value={novoPopForm.conteudo}
                    onChange={e => setNovoPopForm({...novoPopForm, conteudo: e.target.value})}
                    placeholder="Descreva o procedimento passo a passo..."
                    rows={10}
                    className={inputCls + ' resize-y'}
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={salvarNovoPop} disabled={!novoPopForm.titulo.trim() || !novoPopForm.conteudo.trim() || salvandoPop}
                    className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-sm px-6 py-2 rounded-lg transition font-medium">
                    {salvandoPop ? 'Salvando...' : 'Salvar POP'}
                  </button>
                  <button onClick={() => setMostraNovoPop(false)}
                    className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-6 py-2 rounded-lg transition">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Info prioridades */}
            <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-4 mb-4">
              <div className="flex flex-wrap gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400"></span> <strong className="text-red-400">Leia Sempre</strong> <span className="text-gray-500">— conteudo completo em TODAS as respostas</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400"></span> <strong className="text-yellow-400">Importante</strong> <span className="text-gray-500">— conteudo completo sempre que mencionado</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-400"></span> <strong className="text-gray-400">Relevante</strong> <span className="text-gray-500">— conteudo incluido apenas quando o assunto for relacionado</span></span>
              </div>
            </div>

            {/* Busca e filtros */}
            <div className="flex gap-3 mb-4">
              <input
                value={buscaPop}
                onChange={e => setBuscaPop(e.target.value)}
                placeholder="Buscar por título ou conteúdo..."
                className="flex-1 bg-surface-raised border border-white/[0.06] rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#008000] transition"
              />
              <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)}
                className="bg-surface-raised border border-white/[0.06] rounded-lg px-3 py-2 text-gray-300 text-sm focus:outline-none focus:border-[#008000]">
                {categorias.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* Lista de POPs */}
            {loadingPops ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="bg-surface-raised rounded-xl border border-white/[0.06] h-16 animate-pulse" />)}
              </div>
            ) : popsFiltrados.length === 0 ? (
              <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-12 text-center">
                <ClipboardList className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">{buscaPop || categoriaFiltro !== 'Todas' ? 'Nenhum POP encontrado com esses filtros.' : 'Nenhum POP cadastrado ainda.'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {popsFiltrados.map(pop => (
                  <div key={pop.id} className="bg-surface-raised rounded-xl border border-white/[0.06] overflow-hidden">
                    <div
                      className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-800/30 transition"
                      onClick={() => editandoPop !== pop.id && setExpandido(expandido === pop.id ? null : pop.id)}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                        <div>
                          <span className="text-white font-medium">{pop.titulo}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            {pop.categoria && (
                              <span className="text-xs bg-green-900/30 text-brand border border-brand/20/50 px-2 py-0.5 rounded-full">
                                {pop.categoria}
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              pop.prioridade === 'sempre' ? 'bg-red-900/30 text-red-400 border border-red-900/50' :
                              pop.prioridade === 'importante' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-900/50' :
                              'bg-gray-800 text-gray-400 border border-gray-700'
                            }`}>
                              {pop.prioridade === 'sempre' ? 'Leia Sempre' : pop.prioridade === 'importante' ? 'Importante' : 'Relevante'}
                            </span>
                            <span className="text-xs text-gray-600">
                              {new Date(pop.atualizado_em).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={e => { e.stopPropagation(); setEditandoPop(pop.id); setEditPopForm({ titulo: pop.titulo, categoria: pop.categoria, conteudo: pop.conteudo, prioridade: pop.prioridade || 'relevante' }); setExpandido(pop.id) }}
                          className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition">
                          Editar
                        </button>
                        <button onClick={e => { e.stopPropagation(); excluirPop(pop.id, pop.titulo) }}
                          className="text-xs text-red-400 bg-red-900/20 hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition">
                          Arquivar
                        </button>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandido === pop.id ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {expandido === pop.id && (
                      <div className="border-t border-white/[0.06] px-5 py-4">
                        {editandoPop === pop.id ? (
                          <div>
                            <div className="grid grid-cols-3 gap-3 mb-3">
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Título</label>
                                <input value={editPopForm.titulo} onChange={e => setEditPopForm({...editPopForm, titulo: e.target.value})} className={inputEditCls} />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Categoria</label>
                                <select value={editPopForm.categoria} onChange={e => setEditPopForm({...editPopForm, categoria: e.target.value})} className={inputEditCls}>
                                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Prioridade</label>
                                <select value={editPopForm.prioridade || 'relevante'} onChange={e => setEditPopForm({...editPopForm, prioridade: e.target.value})} className={inputEditCls}>
                                  <option value="sempre">Leia Sempre</option>
                                  <option value="importante">Importante</option>
                                  <option value="relevante">Relevante</option>
                                </select>
                              </div>
                            </div>
                            <textarea
                              value={editPopForm.conteudo}
                              onChange={e => setEditPopForm({...editPopForm, conteudo: e.target.value})}
                              rows={15}
                              className={inputEditCls + ' resize-y mb-3'}
                            />
                            <div className="flex gap-3">
                              <button onClick={salvarEdicaoPop} disabled={salvandoPop}
                                className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-sm px-5 py-2 rounded-lg transition">
                                {salvandoPop ? 'Salvando...' : 'Salvar'}
                              </button>
                              <button onClick={() => setEditandoPop(null)}
                                className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-5 py-2 rounded-lg transition">
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
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
          </>
        )}

        {/* ==================== ABA COLABORADORES ==================== */}
        {tab === 'colaboradores' && (
          <>
            {msgColab.texto && (
              <div className={`mb-4 text-sm px-4 py-2.5 rounded-lg border ${msgColab.tipo === 'error' ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-green-900/20 border-green-800 text-brand'}`}>
                {msgColab.texto}
              </div>
            )}

            {/* Adicionar colaborador */}
            <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-5 mb-6">
              <h2 className="text-white font-medium mb-3">+ Adicionar colaborador</h2>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nome *</label>
                  <input value={novoColab.nome} onChange={e => setNovoColab({...novoColab, nome: e.target.value})}
                    placeholder="Ex: Franquelin" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Cargo</label>
                  <input value={novoColab.cargo} onChange={e => setNovoColab({...novoColab, cargo: e.target.value})}
                    placeholder="Ex: Agente de Relacionamento" className={inputCls} />
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs text-gray-400 mb-1">Telefone WhatsApp <span className="text-gray-500">(com DDD, ex: 5543999998888)</span></label>
                <input value={novoColab.telefone_whatsapp} onChange={e => setNovoColab({...novoColab, telefone_whatsapp: e.target.value})}
                  placeholder="5543999998888" className={inputCls} />
              </div>
              <div className="mb-3">
                <label className="block text-xs text-gray-400 mb-1">Funções e responsabilidades</label>
                <textarea value={novoColab.funcoes} onChange={e => setNovoColab({...novoColab, funcoes: e.target.value})}
                  placeholder="Ex: Atende clientes, realiza visitas técnicas..." rows={2}
                  className={inputCls + ' resize-none'} />
              </div>
              <div className="flex justify-end">
                <button onClick={adicionarColab} disabled={!novoColab.nome.trim()}
                  className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-sm px-5 py-2 rounded-lg transition font-medium">
                  Adicionar
                </button>
              </div>
            </div>

            {/* Lista colaboradores */}
            <div className="bg-surface-raised rounded-xl border border-white/[0.06]">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <h2 className="text-white font-medium">Equipe cadastrada</h2>
              </div>
              {colaboradores.length === 0 ? (
                <div className="p-10 text-center">
                  <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Nenhum colaborador cadastrado.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800/60">
                  {colaboradores.map(c => (
                    <div key={c.id} className="px-5 py-4 group">
                      {editandoColab === c.id ? (
                        <div>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Nome</label>
                              <input value={editColabForm.nome || ''} onChange={e => setEditColabForm({...editColabForm, nome: e.target.value})}
                                className={inputEditCls} />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Cargo</label>
                              <input value={editColabForm.cargo || ''} onChange={e => setEditColabForm({...editColabForm, cargo: e.target.value})}
                                className={inputEditCls} />
                            </div>
                          </div>
                          <div className="mb-2">
                            <label className="block text-xs text-gray-400 mb-1">Telefone WhatsApp</label>
                            <input value={editColabForm.telefone_whatsapp || ''} onChange={e => setEditColabForm({...editColabForm, telefone_whatsapp: e.target.value})}
                              placeholder="5543999998888" className={inputEditCls} />
                          </div>
                          <textarea value={editColabForm.funcoes || ''} onChange={e => setEditColabForm({...editColabForm, funcoes: e.target.value})}
                            rows={2} className={inputEditCls + ' resize-none mb-2'} />
                          <div className="flex gap-2">
                            <button onClick={() => salvarColab(c.id)} className="bg-brand hover:bg-brand-dark text-white text-xs px-4 py-1.5 rounded-lg">Salvar</button>
                            <button onClick={() => setEditandoColab(null)} className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-4 py-1.5 rounded-lg">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-4">
                          <div className="w-9 h-9 rounded-full bg-brand/15 border border-brand/20 flex items-center justify-center text-brand-light font-bold text-sm shrink-0">
                            {c.nome.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white font-medium">{c.nome}</span>
                              {c.cargo && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{c.cargo}</span>}
                              {c.telefone_whatsapp && <span className="text-xs bg-green-900/40 text-green-300 px-2 py-0.5 rounded-full font-mono">📱 {c.telefone_whatsapp}</span>}
                            </div>
                            {c.funcoes && <p className="text-gray-400 text-sm mt-1 leading-relaxed">{c.funcoes}</p>}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                            <button onClick={() => { setEditandoColab(c.id); setEditColabForm({nome: c.nome, cargo: c.cargo, funcoes: c.funcoes, telefone_whatsapp: c.telefone_whatsapp || ''}) }}
                              className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg">Editar</button>
                            <button onClick={() => excluirColab(c.id, c.nome)}
                              className="text-xs text-red-400 bg-red-900/20 hover:bg-red-900/40 px-3 py-1.5 rounded-lg">Remover</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ==================== ABA SKILLS ==================== */}
        {tab === 'skills' && (
          <>
            {msgSkill.texto && (
              <div className={`mb-4 text-sm px-4 py-2.5 rounded-lg border ${msgSkill.tipo === 'error' ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-green-900/20 border-green-800 text-brand'}`}>
                {msgSkill.texto}
              </div>
            )}

            <div className="bg-green-900/20 border border-green-800 rounded-xl px-5 py-3 mb-6 text-sm text-brand-light">
              <Zap className="w-4 h-4 inline shrink-0 mr-1" />
              Skills são ativadas por comandos <code className="bg-green-900/40 px-1 rounded">/comando</code> no WhatsApp. O bot injeta o <strong>Prompt Base</strong> automaticamente quando detecta o comando.
            </div>

            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400 text-sm">Comandos especiais que modificam o comportamento do bot</p>
              <button
                onClick={() => { setMostraNovaSkill(true); setEditandoSkill(null) }}
                className="bg-brand hover:bg-brand-dark text-white text-sm px-4 py-2 rounded-lg transition font-medium"
              >
                + Nova Skill
              </button>
            </div>

            {mostraNovaSkill && (
              <div className="bg-surface-raised rounded-xl border border-brand/20 p-6 mb-6">
                <h2 className="text-white font-medium mb-4">Nova Skill</h2>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Comando * <span className="text-gray-600">(ex: /dicas, /chamados)</span></label>
                    <input
                      value={novaSkill.nome}
                      onChange={e => {
                        let v = e.target.value
                        if (v && !v.startsWith('/')) v = '/' + v
                        setNovaSkill({ ...novaSkill, nome: v })
                      }}
                      placeholder="/meu-comando"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Descrição</label>
                    <input
                      value={novaSkill.descricao}
                      onChange={e => setNovaSkill({ ...novaSkill, descricao: e.target.value })}
                      placeholder="O que essa skill faz?"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs text-gray-400 mb-1">Prompt Base * <span className="text-gray-600">(instruções injetadas quando a skill for ativada)</span></label>
                  <textarea
                    value={novaSkill.prompt_base}
                    onChange={e => setNovaSkill({ ...novaSkill, prompt_base: e.target.value })}
                    placeholder="Quando essa skill for ativada, você deve..."
                    rows={6}
                    className={inputCls + ' resize-y'}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-xs text-gray-400 mb-1">Parâmetros opcionais <span className="text-gray-600">(JSON array, uso futuro)</span></label>
                  <input
                    value={novaSkill.parametros_opcionais}
                    onChange={e => setNovaSkill({ ...novaSkill, parametros_opcionais: e.target.value })}
                    placeholder='[]'
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={salvarNovaSkill}
                    disabled={!novaSkill.nome.trim() || !novaSkill.prompt_base.trim() || salvandoSkill}
                    className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-sm px-6 py-2 rounded-lg transition font-medium"
                  >
                    {salvandoSkill ? 'Salvando...' : 'Salvar Skill'}
                  </button>
                  <button onClick={() => setMostraNovaSkill(false)} className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-6 py-2 rounded-lg transition">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {loadingSkills ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="bg-surface-raised rounded-xl border border-white/[0.06] h-16 animate-pulse" />)}
              </div>
            ) : skills.length === 0 ? (
              <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-12 text-center">
                <Zap className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Nenhuma skill cadastrada ainda.</p>
                <p className="text-gray-600 text-sm mt-1">Adicione skills para criar comandos especiais no WhatsApp.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {skills.map(sk => (
                  <div key={sk.id} className="bg-surface-raised rounded-xl border border-white/[0.06] overflow-hidden">
                    {editandoSkill === sk.id ? (
                      <div className="p-5">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Comando</label>
                            <input
                              value={editSkillForm.nome || ''}
                              onChange={e => {
                                let v = e.target.value
                                if (v && !v.startsWith('/')) v = '/' + v
                                setEditSkillForm({ ...editSkillForm, nome: v })
                              }}
                              className={inputEditCls}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Descrição</label>
                            <input
                              value={editSkillForm.descricao || ''}
                              onChange={e => setEditSkillForm({ ...editSkillForm, descricao: e.target.value })}
                              className={inputEditCls}
                            />
                          </div>
                        </div>
                        <label className="block text-xs text-gray-400 mb-1">Prompt Base</label>
                        <textarea
                          value={editSkillForm.prompt_base || ''}
                          onChange={e => setEditSkillForm({ ...editSkillForm, prompt_base: e.target.value })}
                          rows={6}
                          className={inputEditCls + ' resize-y mb-3'}
                        />
                        <label className="block text-xs text-gray-400 mb-1">Parâmetros opcionais (JSON)</label>
                        <input
                          value={typeof editSkillForm.parametros_opcionais === 'string' ? editSkillForm.parametros_opcionais : JSON.stringify(editSkillForm.parametros_opcionais || [])}
                          onChange={e => setEditSkillForm({ ...editSkillForm, parametros_opcionais: e.target.value })}
                          className={inputEditCls + ' mb-3'}
                        />
                        <div className="flex gap-3">
                          <button onClick={salvarEdicaoSkill} disabled={salvandoSkill}
                            className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-sm px-5 py-2 rounded-lg transition">
                            {salvandoSkill ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button onClick={() => setEditandoSkill(null)} className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-5 py-2 rounded-lg transition">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-green-900/30 border border-brand/20/50 flex items-center justify-center shrink-0">
                            <Zap className="w-4 h-4 text-brand" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <code className="text-brand font-mono font-medium">{sk.nome}</code>
                              {!sk.ativo && <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">inativo</span>}
                            </div>
                            {sk.descricao && <p className="text-gray-400 text-sm mt-0.5">{sk.descricao}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleSkillAtivo(sk)}
                            className={`text-xs px-3 py-1.5 rounded-lg transition ${sk.ativo ? 'bg-green-900/30 text-brand hover:bg-brand/15' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                          >
                            {sk.ativo ? 'Ativo' : 'Inativo'}
                          </button>
                          <button
                            onClick={() => {
                              setEditandoSkill(sk.id)
                              setEditSkillForm({ nome: sk.nome, descricao: sk.descricao || '', prompt_base: sk.prompt_base, parametros_opcionais: JSON.stringify(sk.parametros_opcionais || []), ativo: sk.ativo })
                            }}
                            className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => excluirSkill(sk.id, sk.nome)}
                            className="text-xs text-red-400 bg-red-900/20 hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition"
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
          </>
        )}

        {/* ==================== ABA SOLICITAÇÕES ==================== */}
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
                    <input
                      placeholder="Ex: Relatório Diário de Chamados"
                      value={novaSolicitacao.nome}
                      onChange={e => setNovaSolicitacao(p => ({ ...p, nome: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Comando * (igual ao que você digitaria no WhatsApp)</label>
                    <input
                      placeholder="Ex: /relatorio chamados"
                      value={novaSolicitacao.comando}
                      onChange={e => setNovaSolicitacao(p => ({ ...p, comando: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Horário *</label>
                      <input
                        type="time"
                        value={novaSolicitacao.hora}
                        onChange={e => setNovaSolicitacao(p => ({ ...p, hora: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Chat ID (grupo)</label>
                      <input
                        placeholder="554384924456-1616013394@g.us"
                        value={novaSolicitacao.chat_id}
                        onChange={e => setNovaSolicitacao(p => ({ ...p, chat_id: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Dias da Semana</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[['todos','Todos'],['seg','Seg'],['ter','Ter'],['qua','Qua'],['qui','Qui'],['sex','Sex'],['sab','Sáb'],['dom','Dom']].map(([val, label]) => {
                        const isChecked = val === 'todos'
                          ? novaSolicitacao.dias_semana === 'todos'
                          : novaSolicitacao.dias_semana !== 'todos' && novaSolicitacao.dias_semana.split(',').includes(val)
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              if (val === 'todos') {
                                setNovaSolicitacao(p => ({ ...p, dias_semana: 'todos' }))
                              } else {
                                const atual = novaSolicitacao.dias_semana === 'todos' ? [] : novaSolicitacao.dias_semana.split(',').filter(Boolean)
                                const novo = isChecked ? atual.filter(d => d !== val) : [...atual, val]
                                setNovaSolicitacao(p => ({ ...p, dias_semana: novo.length ? novo.join(',') : 'seg' }))
                              }
                            }}
                            className={`text-xs px-3 py-1.5 rounded-lg transition border ${isChecked ? 'bg-brand border-green-700 text-white' : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'}`}
                          >{label}</button>
                        )
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={salvarNovaSolicitacao}
                    disabled={salvandoSolicitacao}
                    className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm transition"
                  >
                    {salvandoSolicitacao ? 'Salvando...' : 'Salvar'}
                  </button>
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
                          <div>
                            <label className="text-gray-400 text-xs mb-1 block">Nome</label>
                            <input value={editSolicitacaoForm.nome || ''} onChange={e => setEditSolicitacaoForm(p => ({ ...p, nome: e.target.value }))} className={inputEditCls} />
                          </div>
                          <div>
                            <label className="text-gray-400 text-xs mb-1 block">Comando</label>
                            <input value={editSolicitacaoForm.comando || ''} onChange={e => setEditSolicitacaoForm(p => ({ ...p, comando: e.target.value }))} className={inputEditCls} />
                          </div>
                          <div>
                            <label className="text-gray-400 text-xs mb-1 block">Horário</label>
                            <input type="time" value={editSolicitacaoForm.hora || ''} onChange={e => setEditSolicitacaoForm(p => ({ ...p, hora: e.target.value }))} className={inputEditCls} />
                          </div>
                          <div>
                            <label className="text-gray-400 text-xs mb-1 block">Chat ID</label>
                            <input value={editSolicitacaoForm.chat_id || ''} onChange={e => setEditSolicitacaoForm(p => ({ ...p, chat_id: e.target.value }))} className={inputEditCls} />
                          </div>
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Dias da Semana</label>
                          <div className="flex flex-wrap gap-2">
                            {[['todos','Todos'],['seg','Seg'],['ter','Ter'],['qua','Qua'],['qui','Qui'],['sex','Sex'],['sab','Sáb'],['dom','Dom']].map(([val, label]) => {
                              const isChecked = val === 'todos'
                                ? editSolicitacaoForm.dias_semana === 'todos'
                                : editSolicitacaoForm.dias_semana !== 'todos' && (editSolicitacaoForm.dias_semana || '').split(',').includes(val)
                              return (
                                <button key={val} type="button"
                                  onClick={() => {
                                    if (val === 'todos') {
                                      setEditSolicitacaoForm(p => ({ ...p, dias_semana: 'todos' }))
                                    } else {
                                      const atual = editSolicitacaoForm.dias_semana === 'todos' ? [] : (editSolicitacaoForm.dias_semana || '').split(',').filter(Boolean)
                                      const novo = isChecked ? atual.filter(d => d !== val) : [...atual, val]
                                      setEditSolicitacaoForm(p => ({ ...p, dias_semana: novo.length ? novo.join(',') : 'seg' }))
                                    }
                                  }}
                                  className={`text-xs px-3 py-1.5 rounded-lg transition border ${isChecked ? 'bg-brand border-green-700 text-white' : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'}`}
                                >{label}</button>
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
                            <span className="text-gray-400 text-xs flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {s.hora}
                            </span>
                            <span className="text-gray-500 text-xs">{s.dias_semana === 'todos' ? 'Todos os dias' : s.dias_semana.replace(/,/g, ' · ')}</span>
                            {s.ultimo_executado && (
                              <span className="text-gray-600 text-xs">Última execução: {new Date(s.ultimo_executado).toLocaleString('pt-BR')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => executarAgora(s)}
                            className="text-xs text-blue-400 bg-blue-900/20 hover:bg-blue-900/40 px-3 py-1.5 rounded-lg transition">Executar Agora</button>
                          <button onClick={() => toggleSolicitacaoAtivo(s)} className={`text-xs px-3 py-1.5 rounded-lg transition ${s.ativo ? 'bg-green-900/30 text-brand hover:bg-brand/15' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                            {s.ativo ? 'Ativo' : 'Inativo'}
                          </button>
                          <button onClick={() => { setEditandoSolicitacao(s.id); setEditSolicitacaoForm({ nome: s.nome, comando: s.comando, chat_id: s.chat_id, hora: s.hora, dias_semana: s.dias_semana, ativo: s.ativo }) }}
                            className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition">Editar</button>
                          <button onClick={() => excluirSolicitacao(s.id, s.nome)}
                            className="text-xs text-red-400 bg-red-900/20 hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition">Excluir</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ==================== ABA EVOLUTIVO ==================== */}
        {tab === 'evolutivo' && <EvolutivoTab inputCls={inputCls} />}

      </main>
    </div>
  )
}

// ── Treinamento Evolutivo (Obsidian) ─────────────────────────────────────────
function EvolutivoTab({ inputCls }) {
  const [config, setConfig] = useState({ nome: 'Cerebro Evolutivo', pasta: 'cerebro-evolutivo', ignorar: '.obsidian,templates,lixeira,trash' })
  const [status, setStatus] = useState(null)
  const [docs, setDocs] = useState([])
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [validating, setValidating] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [validResult, setValidResult] = useState(null)
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [msg, setMsg] = useState({ texto: '', tipo: '' })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  function showMsg(texto, tipo = 'ok') {
    setMsg({ texto, tipo })
    setTimeout(() => setMsg({ texto: '', tipo: '' }), 5000)
  }

  async function carregarStatus() {
    setLoadingStatus(true)
    try {
      const r = await fetch('/api/treinamento-evolutivo/status')
      if (r.ok) {
        const d = await r.json()
        setStatus(d)
        if (d.fonte) setConfig(c => ({ ...c, nome: d.fonte.nome || c.nome, pasta: d.fonte.pasta || c.pasta, ignorar: d.fonte.ignorar || c.ignorar }))
      }
    } finally { setLoadingStatus(false) }
  }

  async function carregarDocs(p = 1) {
    const r = await fetch(`/api/treinamento-evolutivo/documentos?page=${p}`)
    if (r.ok) {
      const d = await r.json()
      setDocs(d.documentos || [])
      setTotalPages(d.pages || 1)
      setPage(p)
    }
  }

  useEffect(() => {
    carregarStatus()
    carregarDocs()
  }, [])

  async function salvarConfig() {
    setSalvandoConfig(true)
    try {
      const r = await fetch('/api/treinamento-evolutivo/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (r.ok) { showMsg('Configuração salva!'); carregarStatus() }
      else { const d = await r.json(); showMsg(d.error || 'Erro ao salvar', 'error') }
    } finally { setSalvandoConfig(false) }
  }

  async function validarCaminho() {
    setValidating(true)
    setValidResult(null)
    try {
      const r = await fetch('/api/treinamento-evolutivo/validar-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pasta: config.pasta }),
      })
      const d = await r.json()
      setValidResult(d)
    } finally { setValidating(false) }
  }

  async function sincronizar() {
    setSyncing(true)
    setSyncResult(null)
    try {
      await salvarConfig()
      const r = await fetch('/api/treinamento-evolutivo/sync', { method: 'POST' })
      const d = await r.json()
      if (r.ok) {
        setSyncResult(d)
        showMsg(`Sync completo: ${d.atualizados} atualizados, ${d.pulados} sem mudança, ${d.erros} erros.`)
        carregarStatus()
        carregarDocs()
      } else {
        showMsg(d.error || 'Erro ao sincronizar', 'error')
      }
    } finally { setSyncing(false) }
  }

  return (
    <div className="animate-fade-in">
      {/* Banner */}
      <div className="bg-purple-900/20 border border-purple-800 rounded-xl px-5 py-3 mb-6 text-sm text-purple-300">
        <BookOpen className="w-4 h-4 inline shrink-0 mr-1" />
        <strong>Treinamento Evolutivo</strong> — lê notas Markdown da pasta configurada, indexa em chunks e injeta como contexto adicional (não normativo) no bot.
        POPs têm prioridade em caso de conflito.
      </div>

      {msg.texto && (
        <div className={`mb-4 text-sm px-4 py-2.5 rounded-lg border ${msg.tipo === 'error' ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-green-900/20 border-green-800 text-brand'}`}>
          {msg.texto}
        </div>
      )}

      {/* Config */}
      <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-5 mb-5">
        <h3 className="text-white font-semibold mb-4 text-sm">Configuração da fonte</h3>
        <div className="grid grid-cols-1 gap-3 mb-4">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Nome da fonte</label>
            <input className={inputCls} value={config.nome} onChange={e => setConfig(c => ({ ...c, nome: e.target.value }))} placeholder="Ex: Cerebro Evolutivo" />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Pasta (relativa à raiz do projeto ou path absoluto)</label>
            <div className="flex gap-2">
              <input className={inputCls} value={config.pasta} onChange={e => { setConfig(c => ({ ...c, pasta: e.target.value })); setValidResult(null) }} placeholder="cerebro-evolutivo" />
              <button onClick={validarCaminho} disabled={validating} className="shrink-0 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition">
                {validating ? '...' : 'Validar'}
              </button>
            </div>
            {validResult && (
              <div className={`mt-1.5 text-xs flex items-center gap-1.5 ${validResult.ok ? 'text-brand' : 'text-red-400'}`}>
                {validResult.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {validResult.ok ? `Pasta válida — ${validResult.mdCount} arquivo(s) .md encontrado(s)` : validResult.erro}
              </div>
            )}
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Pastas/arquivos a ignorar (separados por vírgula)</label>
            <input className={inputCls} value={config.ignorar} onChange={e => setConfig(c => ({ ...c, ignorar: e.target.value }))} placeholder=".obsidian,templates,lixeira,trash" />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={salvarConfig} disabled={salvandoConfig} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg transition">
            {salvandoConfig ? 'Salvando...' : 'Salvar configuração'}
          </button>
          <button onClick={sincronizar} disabled={syncing} className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg transition flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
          </button>
        </div>
      </div>

      {/* Métricas */}
      {loadingStatus ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[1,2,3,4].map(i => <div key={i} className="bg-surface-raised rounded-xl border border-white/[0.06] h-20 animate-pulse" />)}
        </div>
      ) : status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Notas indexadas', value: status.totalDocumentos },
            { label: 'Chunks gerados', value: status.totalChunks },
            { label: 'Última sync', value: status.fonte?.ultima_sync ? new Date(status.fonte.ultima_sync).toLocaleString('pt-BR') : '—' },
            { label: 'Erros de leitura', value: status.totalErros, destaque: status.totalErros > 0 },
          ].map(({ label, value, destaque }) => (
            <div key={label} className="bg-surface-raised rounded-xl border border-white/[0.06] px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className={`text-2xl font-bold font-display ${destaque ? 'text-red-400' : 'text-white'}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Último resultado de sync */}
      {syncResult && (
        <div className="bg-surface-raised rounded-xl border border-white/[0.06] px-5 py-4 mb-5 text-sm">
          <div className="text-gray-300 font-medium mb-2">Resultado da última sincronização</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Lidos', syncResult.lidos, 'text-white'],
              ['Atualizados', syncResult.atualizados, 'text-brand'],
              ['Sem mudança', syncResult.pulados, 'text-gray-400'],
              ['Erros', syncResult.erros, syncResult.erros > 0 ? 'text-red-400' : 'text-gray-500'],
            ].map(([label, val, cls]) => (
              <div key={label}>
                <span className="text-gray-500 text-xs">{label}: </span>
                <span className={`font-semibold ${cls}`}>{val}</span>
              </div>
            ))}
          </div>
          {syncResult.detalhes?.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs text-gray-500 cursor-pointer">Ver erros ({syncResult.detalhes.length})</summary>
              <ul className="mt-2 space-y-1">
                {syncResult.detalhes.map((d, i) => (
                  <li key={i} className="text-xs text-red-400 font-mono">{d.caminho}: {d.erro}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Tabela de documentos */}
      {docs.length > 0 && (
        <div className="bg-surface-raised rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-gray-300 font-medium text-sm">Notas indexadas ({status?.totalDocumentos || 0})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {['Título', 'Caminho', 'Chunks', 'Status', 'Atualizado'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => (
                  <tr key={doc.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-white text-xs font-medium max-w-xs truncate">{doc.titulo || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs font-mono max-w-xs truncate">{doc.caminho}</td>
                    <td className="px-4 py-2.5 text-gray-300 text-xs">{doc.chunks}</td>
                    <td className="px-4 py-2.5">
                      {doc.erro
                        ? <span className="flex items-center gap-1 text-red-400 text-xs"><AlertCircle className="w-3 h-3" /> Erro</span>
                        : <span className="flex items-center gap-1 text-brand text-xs"><CheckCircle className="w-3 h-3" /> OK</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {doc.atualizado_em ? new Date(doc.atualizado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-5 py-3 flex gap-2 justify-end border-t border-white/[0.06]">
              {page > 1 && <button onClick={() => carregarDocs(page - 1)} className="text-xs text-gray-400 hover:text-white px-3 py-1 rounded-lg bg-gray-800 transition">← Anterior</button>}
              <span className="text-xs text-gray-500 self-center">Página {page} de {totalPages}</span>
              {page < totalPages && <button onClick={() => carregarDocs(page + 1)} className="text-xs text-gray-400 hover:text-white px-3 py-1 rounded-lg bg-gray-800 transition">Próxima →</button>}
            </div>
          )}
        </div>
      )}

      {!loadingStatus && docs.length === 0 && status?.totalDocumentos === 0 && (
        <div className="text-center py-12 text-gray-500 text-sm">
          Nenhuma nota indexada ainda.
          <br /><span className="text-xs mt-1 block">Configure a pasta acima e clique em "Sincronizar agora".</span>
        </div>
      )}
    </div>
  )
}
