'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import StatusCard from '@/components/StatusCard'
import ExecutionList from '@/components/ExecutionList'
import { RefreshCw } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [filiais, setFiliais] = useState([])
  const [executions, setExecutions] = useState([])
  const [selectedFilial, setSelectedFilial] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) router.push('/login')
      else return r.json()
    }).then(d => d && setUser(d))
  }, [router])

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, execRes] = await Promise.all([
        fetch('/api/status'),
        fetch(`/api/executions${selectedFilial ? `?filialId=${selectedFilial}` : ''}`)
      ])
      if (statusRes.ok) setFiliais(await statusRes.json())
      if (execRes.ok) setExecutions(await execRes.json())
      setLastUpdate(new Date())
    } catch {}
    setLoading(false)
  }, [selectedFilial])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchStatus])

  const totalErros = filiais.reduce((a, f) => a + (f.errosHoje || 0), 0)
  const totalMensagens = filiais.reduce((a, f) => a + (f.mensagensHoje || 0), 0)
  const botsOnline = filiais.filter(f => f.online).length

  return (
    <div className="min-h-screen bg-transparent">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Visão Geral</h1>
            <p className="text-gray-400 text-sm mt-1">
              {lastUpdate ? `Atualizado às ${lastUpdate.toLocaleTimeString('pt-BR')}` : 'Carregando...'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <div
                onClick={() => setAutoRefresh(v => !v)}
                className={`w-10 h-5 rounded-full transition-colors ${autoRefresh ? 'bg-[#008000]' : 'bg-gray-700'} relative cursor-pointer`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${autoRefresh ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              Auto-refresh (30s)
            </label>
            <button
              onClick={fetchStatus}
              className="bg-gray-800 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg transition"
            >
              <RefreshCw className="w-3.5 h-3.5 inline mr-1.5" />
              Atualizar
            </button>
          </div>
        </div>

        {/* Métricas globais */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-[#0f0f13]/40 backdrop-blur-md rounded-2xl p-6 border border-gray-800/50 hover:border-green-500/30 hover:shadow-[0_0_20px_rgba(0,128,0,0.1)] transition-all duration-300 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <p className="text-gray-400 text-sm font-medium tracking-wide uppercase">Bots Online</p>
            <p className="text-4xl font-bold text-white mt-2 drop-shadow-md">{botsOnline}<span className="text-gray-500 text-xl font-normal ml-1">/{filiais.length}</span></p>
          </div>
          <div className="bg-[#0f0f13]/40 backdrop-blur-md rounded-2xl p-6 border border-gray-800/50 hover:border-green-500/30 hover:shadow-[0_0_20px_rgba(0,128,0,0.1)] transition-all duration-300 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <p className="text-gray-400 text-sm font-medium tracking-wide uppercase">Mensagens Hoje</p>
            <p className="text-4xl font-bold text-green-400 mt-2 glow-sm">{totalMensagens}</p>
          </div>
          <div className="bg-[#0f0f13]/40 backdrop-blur-md rounded-2xl p-6 border border-gray-800/50 hover:border-red-500/30 hover:shadow-[0_0_20px_rgba(248,113,113,0.1)] transition-all duration-300 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <p className="text-gray-400 text-sm font-medium tracking-wide uppercase">Erros Hoje</p>
            <p className={`text-4xl font-bold mt-2 ${totalErros > 0 ? 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]' : 'text-white'}`}>{totalErros}</p>
          </div>
        </div>

        {/* Cards das filiais */}
        <h2 className="text-gray-300 font-medium mb-4">Filiais</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[1,2,3].map(i => (
              <div key={i} className="bg-[#1a1a24] rounded-xl p-6 border border-gray-800 animate-pulse h-40" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {filiais.map(f => (
              <StatusCard
                key={f.id}
                filial={f}
                selected={selectedFilial === f.id}
                onSelect={() => setSelectedFilial(selectedFilial === f.id ? null : f.id)}
              />
            ))}
          </div>
        )}

        {/* Execuções recentes */}
        <div className="bg-[#0f0f13]/40 backdrop-blur-md rounded-2xl border border-gray-800/50 overflow-hidden shadow-lg animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
          <div className="px-6 py-4 border-b border-gray-800/50 flex items-center justify-between bg-black/20">
            <h2 className="font-medium text-white tracking-wide">
              Execuções Recentes
              {selectedFilial && (
                <span className="ml-2 text-sm text-green-400 font-normal">
                  — {filiais.find(f => f.id === selectedFilial)?.nome}
                </span>
              )}
            </h2>
            {selectedFilial && (
              <button onClick={() => setSelectedFilial(null)} className="text-xs text-gray-400 hover:text-green-400 hover:glow-sm transition-all duration-300">
                Mostrar todas
              </button>
            )}
          </div>
          <div className="bg-black/10">
            <ExecutionList executions={executions} />
          </div>
        </div>
      </main>
    </div>
  )
}
