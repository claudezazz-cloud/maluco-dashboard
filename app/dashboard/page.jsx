'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import StatusCard from '@/components/StatusCard'
import ExecutionList from '@/components/ExecutionList'

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
    <div className="min-h-screen bg-[#0f0f13]">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 py-8">
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
              ↻ Atualizar
            </button>
          </div>
        </div>

        {/* Métricas globais */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-[#1a1a24] rounded-xl p-5 border border-gray-800">
            <p className="text-gray-400 text-sm">Bots Online</p>
            <p className="text-3xl font-bold text-white mt-1">{botsOnline}<span className="text-gray-500 text-lg">/{filiais.length}</span></p>
          </div>
          <div className="bg-[#1a1a24] rounded-xl p-5 border border-gray-800">
            <p className="text-gray-400 text-sm">Mensagens Hoje</p>
            <p className="text-3xl font-bold text-green-400 mt-1">{totalMensagens}</p>
          </div>
          <div className="bg-[#1a1a24] rounded-xl p-5 border border-gray-800">
            <p className="text-gray-400 text-sm">Erros Hoje</p>
            <p className={`text-3xl font-bold mt-1 ${totalErros > 0 ? 'text-red-400' : 'text-white'}`}>{totalErros}</p>
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
        <div className="bg-[#1a1a24] rounded-xl border border-gray-800">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-medium text-white">
              Execuções Recentes
              {selectedFilial && (
                <span className="ml-2 text-sm text-green-400">
                  — {filiais.find(f => f.id === selectedFilial)?.nome}
                </span>
              )}
            </h2>
            {selectedFilial && (
              <button onClick={() => setSelectedFilial(null)} className="text-xs text-gray-400 hover:text-white">
                Mostrar todas
              </button>
            )}
          </div>
          <ExecutionList executions={executions} />
        </div>
      </main>
    </div>
  )
}
