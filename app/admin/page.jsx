'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [filiais, setFiliais] = useState([])
  const [tab, setTab] = useState('filiais')
  const [msg, setMsg] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [grupoId, setGrupoId] = useState('')
  const [salvandoGrupo, setSalvandoGrupo] = useState(false)

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
      if (r.ok) {
        const d = await r.json()
        setGrupoId(d.grupo || '')
      }
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
    <div className="min-h-screen bg-[#0f0f13]">
      <Navbar user={user} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">Administração</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#1a1a24] rounded-lg p-1 w-fit">
          {[['filiais', 'Filiais'], ['usuarios', 'Usuários'], ['configuracoes', 'Configurações']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition ${tab === key ? 'bg-[#008000] text-white' : 'text-gray-400 hover:text-white'}`}
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
                className="bg-[#008000] hover:bg-[#006600] text-white text-sm px-4 py-2 rounded-lg transition"
              >
                + Nova Filial
              </Link>
            </div>

            {msg && (
              <div className="mb-4 text-sm text-green-400 bg-green-900/20 border border-green-800 rounded-lg px-4 py-2">
                {msg}
              </div>
            )}

            {/* Filial cards */}
            <div className="space-y-3">
              {filiais.map(f => (
                <div key={f.id} className="bg-[#1a1a24] rounded-xl border border-gray-800 px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium">{f.nome}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${f.ativo ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
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
                    className="bg-[#008000] hover:bg-[#006600] text-white text-sm px-5 py-2 rounded-lg transition"
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
                className="bg-[#008000] hover:bg-[#006600] text-white text-sm px-4 py-2 rounded-lg transition"
              >
                {mostraNovoUsuario ? 'Cancelar' : '+ Novo Usuário'}
              </button>
            </div>

            {msg && (
              <div className={`mb-4 text-sm rounded-lg px-4 py-2 border ${msg.startsWith('Erro') ? 'text-red-400 bg-red-900/20 border-red-800' : 'text-green-400 bg-green-900/20 border-green-800'}`}>
                {msg}
              </div>
            )}

            {/* Form novo usuário */}
            {mostraNovoUsuario && (
              <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-5 mb-4">
                <h3 className="text-white font-medium text-sm mb-4">Novo Usuário</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Nome</label>
                    <input
                      type="text"
                      value={novoUsuario.nome}
                      onChange={e => setNovoUsuario({ ...novoUsuario, nome: e.target.value })}
                      placeholder="Nome do colaborador"
                      className="w-full bg-[#0f0f13] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:border-[#008000] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Email</label>
                    <input
                      type="email"
                      value={novoUsuario.email}
                      onChange={e => setNovoUsuario({ ...novoUsuario, email: e.target.value })}
                      placeholder="email@exemplo.com"
                      className="w-full bg-[#0f0f13] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:border-[#008000] focus:outline-none"
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
                        className="w-full bg-[#0f0f13] border border-gray-700 rounded-lg px-3 py-2 pr-10 text-white text-sm placeholder-gray-600 focus:border-[#008000] focus:outline-none"
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
                      className="w-full bg-[#0f0f13] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#008000] focus:outline-none"
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
                    className="bg-[#008000] hover:bg-[#006600] disabled:opacity-40 text-white text-sm px-6 py-2 rounded-lg transition font-medium"
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
                <div key={u.id} className="bg-[#1a1a24] rounded-xl border border-gray-800 px-5 py-4">
                  {editandoUsuario === u.id ? (
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Nome</label>
                          <input
                            type="text"
                            value={editUsuarioForm.nome || ''}
                            onChange={e => setEditUsuarioForm({ ...editUsuarioForm, nome: e.target.value })}
                            className="w-full bg-[#0f0f13] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#008000] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Email</label>
                          <input
                            type="email"
                            value={editUsuarioForm.email || ''}
                            onChange={e => setEditUsuarioForm({ ...editUsuarioForm, email: e.target.value })}
                            className="w-full bg-[#0f0f13] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#008000] focus:outline-none"
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
                              className="w-full bg-[#0f0f13] border border-gray-700 rounded-lg px-3 py-2 pr-10 text-white text-sm placeholder-gray-600 focus:border-[#008000] focus:outline-none"
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
                            className="w-full bg-[#0f0f13] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-[#008000] focus:outline-none"
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
                          className="bg-[#008000] hover:bg-[#006600] disabled:opacity-40 text-white text-sm px-5 py-2 rounded-lg transition font-medium"
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
                          <span className={`text-xs px-2 py-0.5 rounded ${u.role === 'admin' ? 'bg-green-900/40 text-green-400' : 'bg-blue-900/40 text-blue-400'}`}>
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

        {/* Configurações */}
        {tab === 'configuracoes' && (
          <div>
            <h2 className="text-gray-300 font-medium mb-4">Configurações do Bot</h2>

            {msg && (
              <div className="mb-4 text-sm text-green-400 bg-green-900/20 border border-green-800 rounded-lg px-4 py-2">
                {msg}
              </div>
            )}

            <div className="bg-[#1a1a24] rounded-xl border border-gray-800 p-5">
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
                  className="flex-1 bg-[#0f0f13] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:border-[#008000] focus:outline-none transition"
                />
                <button
                  onClick={salvarGrupo}
                  disabled={salvandoGrupo || !grupoId.trim()}
                  className="bg-[#008000] hover:bg-[#006600] disabled:opacity-40 text-white text-sm px-6 py-2.5 rounded-lg transition font-medium shrink-0"
                >
                  {salvandoGrupo ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-xs text-gray-500">
                  Para encontrar o ID do grupo: abra a Evolution API ou verifique nos logs do webhook. O ID sempre termina com @g.us
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
