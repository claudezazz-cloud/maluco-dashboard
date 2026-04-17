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

      <main className="max-w-7xl mx-auto px-6 py-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-bold text-white tracking-tight">Visao Geral</h1>
            <p className="text-gray-600 text-sm mt-1 font-mono">
              {lastUpdate ? `${lastUpdate.toLocaleTimeString('pt-BR')}` : '...'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(v => !v)}
              className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border transition-all duration-200 ${
                autoRefresh
                  ? 'text-brand/80 bg-brand/[0.06] border-brand/20'
                  : 'text-gray-600 bg-white/[0.02] border-white/[0.04] hover:border-white/[0.08]'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-brand animate-pulse' : 'bg-gray-600'}`} />
              Auto 30s
            </button>
            <button
              onClick={fetchStatus}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/[0.08] px-3 py-2 rounded-lg transition-all duration-200"
            >
              <RefreshCw className="w-3 h-3" />
              Atualizar
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'Bots Online', value: botsOnline, suffix: `/${filiais.length}`, color: 'text-white' },
            { label: 'Mensagens Hoje', value: totalMensagens, color: 'text-brand glow-sm' },
            { label: 'Erros Hoje', value: totalErros, color: totalErros > 0 ? 'text-red-400' : 'text-white' },
          ].map((m, i) => (
            <div
              key={m.label}
              className="bg-surface-raised/60 border border-white/[0.04] rounded-2xl p-6 hover:border-white/[0.08] transition-all duration-300 animate-fade-in-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <p className="text-[11px] text-gray-600 font-medium tracking-widest uppercase">{m.label}</p>
              <p className={`text-3xl font-display font-bold mt-2 ${m.color}`}>
                {m.value}
                {m.suffix && <span className="text-gray-600 text-lg font-normal ml-0.5">{m.suffix}</span>}
              </p>
            </div>
          ))}
        </div>

        {/* Branch Cards */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-sm font-semibold text-gray-400 uppercase tracking-wider">Filiais</h2>
          {selectedFilial && (
            <button onClick={() => setSelectedFilial(null)} className="text-[11px] text-gray-600 hover:text-brand transition-colors">
              Limpar filtro
            </button>
          )}
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {[1,2,3].map(i => (
              <div key={i} className="bg-surface-raised/40 rounded-2xl p-6 border border-white/[0.04] animate-pulse h-40" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
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

        {/* Recent Executions */}
        <div className="bg-surface-raised/60 border border-white/[0.04] rounded-2xl overflow-hidden animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
            <h2 className="font-display font-semibold text-white text-sm tracking-wide">
              Execucoes Recentes
              {selectedFilial && (
                <span className="ml-2 text-brand/70 font-normal">
                  {filiais.find(f => f.id === selectedFilial)?.nome}
                </span>
              )}
            </h2>
          </div>
          <ExecutionList executions={executions} />
        </div>
      </main>
    </div>
  )
}
