'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, CheckCircle2, AlertCircle, Clock, Zap, ChevronRight, User, Filter } from 'lucide-react'

export default function ServicosDashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [tarefas, setTarefas] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState('TODOS')

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => {
        if (!r.ok) router.push('/login')
        else return r.json()
      })
      .then(d => {
        if (d) {
          setUser(d)
          if (d.role !== 'admin') {
            let n = d.nome
            if (n === 'Junior Souza' || n === 'Junior Souza (Russo)') n = 'Russo'
            setSelectedUser(n)
          }
        }
      })
      .catch(console.error)

    const fetchTarefas = () => {
      fetch('/api/tarefas')
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d)) {
            setTarefas(d)
          } else {
            console.error("API retornou erro:", d)
            // Mantém as tarefas antigas na tela se a API der engasgo
          }
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }

    fetchTarefas()
    const intervalo = setInterval(fetchTarefas, 30000) // Atualiza a cada 30s

    return () => clearInterval(intervalo)
  }, [router])

  const responsaveis = useMemo(() => {
    const todos = tarefas.map(t => t.responsavel).filter(Boolean)
    const split = todos.flatMap(str => {
      return str.split(',').map(s => {
        const name = s.trim()
        if (name === 'Negos Info' || name === 'Negos Oliveira') return 'Negos'
        if (name === 'Junior Souza' || name === 'Junior Souza (Russo)') return 'Russo'
        return name
      })
    })
    return [...new Set(split)].sort()
  }, [tarefas])

  const tarefasFiltradas = useMemo(() => {
    if (selectedUser === 'TODOS') return tarefas
    return tarefas.filter(t => {
      if (!t.responsavel) return false
      const reps = t.responsavel.split(',').map(s => s.trim())
      
      if (selectedUser === 'Negos') {
        return reps.some(r => r === 'Negos Info' || r === 'Negos Oliveira' || r === 'Negos')
      }
      if (selectedUser === 'Russo' || selectedUser === 'Junior Souza' || selectedUser === 'Junior Souza (Russo)') {
        return reps.some(r => r === 'Junior Souza' || r === 'Junior Souza (Russo)' || r === 'Russo')
      }
      
      return reps.includes(selectedUser)
    })
  }, [tarefas, selectedUser])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  const isAdmin = user.role === 'admin'

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 font-sans flex flex-col relative overflow-hidden">
      {/* Efeitos de Luz no Fundo */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Navbar Premium (Super Compacta) */}
      <header className="h-10 border-b border-white/[0.03] bg-white/[0.01] backdrop-blur-2xl flex items-center justify-between px-4 shrink-0 relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-sm text-white tracking-tight leading-none">Zazz Workspace</h1>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="px-4 py-2 rounded-xl border border-white/[0.05] bg-black/40 shadow-inner flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-white">{user.nome}</span>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">{user.role}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-white/[0.05] flex items-center justify-center">
              <User className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          <button 
            onClick={() => {
              document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
              router.push('/login')
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/[0.05] text-gray-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all duration-300"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Sidebar com Glassmorphism (Compacta) */}
        <aside className="w-48 border-r border-white/[0.03] bg-white/[0.01] backdrop-blur-xl p-3 flex flex-col overflow-y-auto hidden md:flex shrink-0 scrollbar-hide">
          {isAdmin ? (
            <>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedUser('TODOS')}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 border ${
                    selectedUser === 'TODOS'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                      : 'bg-black/20 border-white/[0.03] text-gray-400 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  Todos os Serviços
                  {selectedUser === 'TODOS' && <ChevronRight className="w-4 h-4" />}
                </button>

                <div className="pt-2 pb-1">
                  <h3 className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest px-1">
                    Equipe Técnica
                  </h3>
                </div>

                {responsaveis.map(resp => (
                  <button
                    key={resp}
                    onClick={() => setSelectedUser(resp)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all duration-300 border group ${
                      selectedUser === resp
                        ? 'bg-white/5 border-white/10 text-white shadow-lg'
                        : 'bg-transparent border-transparent text-gray-400 hover:bg-white/[0.02] hover:text-gray-200'
                    }`}
                  >
                    {resp}
                    {selectedUser === resp && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-2xl p-6 text-center shadow-[0_0_30px_rgba(16,185,129,0.05)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 mx-auto mb-4 flex items-center justify-center border border-emerald-500/30">
                <span className="text-emerald-400 font-display font-bold text-2xl">
                  {user.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <h2 className="text-white font-medium text-lg mb-1">{user.nome}</h2>
              <p className="text-xs text-emerald-500/80 uppercase tracking-widest font-semibold">Técnico Autorizado</p>
            </div>
          )}
        </aside>

        {/* Área Principal */}
        <main className="flex-1 p-3 md:p-4 overflow-y-auto scrollbar-hide">
          <div className="max-w-none mx-auto h-full flex flex-col">
            {/* Header da Tabela (Compacto) */}
            <div className="mb-3 flex flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-lg font-bold text-white tracking-tight">Painel de Acompanhamento</h2>
                <span className="text-white text-xs font-medium px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.05]">{selectedUser}</span>
              </div>
              <div className="bg-black/40 border border-white/[0.05] rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-xl backdrop-blur-md">
                <span className="text-lg font-display font-bold text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)] leading-none">
                  {tarefasFiltradas.length}
                </span>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Total em Fila</span>
                  <span className="text-sm text-gray-300">Pendências Abertas</span>
                </div>
              </div>
            </div>

            {/* Tabela Premium (Ultra Compacta) */}
            <div className="bg-black/40 border border-white/[0.05] rounded-xl overflow-hidden shadow-2xl backdrop-blur-md flex-1">
              <div className="overflow-x-auto h-full scrollbar-hide">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-white/[0.02] border-b border-white/[0.05] sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-400 uppercase tracking-widest text-[9px]">Demanda</th>
                      <th className="px-3 py-2 font-semibold text-gray-400 uppercase tracking-widest text-[9px]">Categoria</th>
                      <th className="px-3 py-2 font-semibold text-gray-400 uppercase tracking-widest text-[9px]">Status</th>
                      <th className="px-3 py-2 font-semibold text-gray-400 uppercase tracking-widest text-[9px]">Responsável</th>
                      <th className="px-3 py-2 font-semibold text-gray-400 uppercase tracking-widest text-[9px]">Prazo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {tarefasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-3 py-8 text-center">
                          <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500/50" />
                          </div>
                          <p className="text-gray-400 text-lg">Tudo limpo por aqui.</p>
                          <p className="text-gray-600 text-sm mt-1">Nenhum serviço pendente nesta fila.</p>
                        </td>
                      </tr>
                    ) : (
                      tarefasFiltradas.map((tarefa, i) => {
                        const isLate = tarefa.entrega && new Date(tarefa.entrega) < new Date() && new Date(tarefa.entrega).setHours(0,0,0,0) !== new Date().setHours(0,0,0,0);
                        
                        return (
                          <tr key={tarefa.id} className="hover:bg-white/[0.02] transition-colors duration-200">
                            <td className="px-3 py-1.5">
                              <div className="font-medium text-[11px] text-gray-200 truncate max-w-[400px]">
                                {tarefa.titulo}
                              </div>
                            </td>
                            <td className="px-3 py-1.5">
                              {tarefa.tipo ? (
                                <div className="flex gap-1 flex-wrap">
                                  {tarefa.tipo.split(',').map(t => (
                                    <span key={t} className="px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                      {t.trim()}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-600">—</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center w-fit gap-1">
                                <span className="w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.6)]" />
                                {tarefa.status || 'Sem status'}
                              </span>
                            </td>
                            <td className="px-3 py-1.5">
                                <span className="text-[11px] text-gray-400 font-medium truncate block max-w-[150px]">
                                  {tarefa.responsavel ? tarefa.responsavel
                                    .replace('Negos Info', 'Negos')
                                    .replace('Negos Oliveira', 'Negos')
                                    .replace('Junior Souza', 'Russo') : '—'}
                                </span>
                            </td>
                            <td className="px-3 py-1.5">
                              {tarefa.entrega ? (
                                <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border w-fit ${
                                  isLate 
                                    ? 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]' 
                                    : 'bg-white/[0.02] text-gray-400 border-white/[0.05]'
                                }`}>
                                  {isLate ? <AlertCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                  {tarefa.entrega.split('-').reverse().join('/')}
                                </span>
                              ) : (
                                <span className="text-gray-600">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
