import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react'

export default function StatusCard({ filial, selected, onSelect }) {
  const { nome, online, workflowNome, ultimaExecucao, errosHoje, mensagensHoje } = filial

  function formatTime(iso) {
    if (!iso) return '--'
    const d = new Date(iso)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(iso) {
    if (!iso) return '--'
    const d = new Date(iso)
    const hoje = new Date()
    if (d.toDateString() === hoje.toDateString()) return `Hoje ${formatTime(iso)}`
    return d.toLocaleDateString('pt-BR') + ' ' + formatTime(iso)
  }

  const statusColor = ultimaExecucao?.status === 'success' ? 'text-emerald-400'
    : ultimaExecucao?.status === 'error' ? 'text-red-400'
    : ultimaExecucao?.status === 'running' ? 'text-amber-400'
    : 'text-gray-600'

  const StatusIcon = ultimaExecucao?.status === 'success' ? CheckCircle2
    : ultimaExecucao?.status === 'error' ? XCircle
    : ultimaExecucao?.status === 'running' ? RefreshCw
    : null

  const statusText = ultimaExecucao?.status === 'success' ? 'OK'
    : ultimaExecucao?.status === 'error' ? 'Erro'
    : ultimaExecucao?.status === 'running' ? 'Rodando'
    : '--'

  return (
    <div
      onClick={onSelect}
      className={`group relative rounded-2xl border p-5 cursor-pointer transition-all duration-300 ${
        selected
          ? 'bg-brand/[0.04] border-brand/30 shadow-[0_0_20px_rgba(0,200,83,0.08)]'
          : 'bg-surface-raised/60 border-white/[0.04] hover:border-white/[0.08] hover:bg-surface-raised'
      }`}
    >
      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-brand/50 to-transparent" />
      )}

      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold text-white text-[15px]">{nome}</h3>
          <p className="text-[11px] text-gray-600 mt-0.5 font-mono">{workflowNome || 'Sem workflow'}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${
            online
              ? 'bg-brand shadow-[0_0_8px_rgba(0,200,83,0.5)] animate-pulse-glow'
              : 'bg-red-500/80'
          }`} />
          <span className={`text-xs font-medium ${online ? 'text-brand' : 'text-red-400/80'}`}>
            {online ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/[0.02] border border-white/[0.03] rounded-xl p-3 group-hover:border-white/[0.06] transition-colors">
          <p className="text-[10px] text-gray-600 mb-1 uppercase tracking-widest font-semibold">Msgs</p>
          <p className="text-lg font-display font-bold text-white">{mensagensHoje}</p>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.03] rounded-xl p-3 group-hover:border-white/[0.06] transition-colors">
          <p className="text-[10px] text-gray-600 mb-1 uppercase tracking-widest font-semibold">Erros</p>
          <p className={`text-lg font-display font-bold ${errosHoje > 0 ? 'text-red-400' : 'text-white'}`}>{errosHoje}</p>
        </div>
      </div>

      {ultimaExecucao && (
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className="text-gray-600 font-mono">{formatDate(ultimaExecucao.inicio)}</span>
          <span className={`font-medium flex items-center gap-1 ${statusColor}`}>
            {StatusIcon && <StatusIcon className="w-3 h-3" />}
            {statusText}
          </span>
        </div>
      )}
    </div>
  )
}
