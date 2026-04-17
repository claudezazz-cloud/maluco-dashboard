import { CheckCircle2, XCircle, RefreshCw, Clock } from 'lucide-react'

export default function ExecutionList({ executions }) {
  if (!executions?.length) {
    return <p className="text-gray-600 text-sm text-center py-12">Nenhuma execucao encontrada.</p>
  }

  function formatDateTime(iso) {
    if (!iso) return '--'
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  function StatusBadge({ status }) {
    const map = {
      success: 'bg-brand/10 text-brand border-brand/20',
      error: 'bg-red-500/10 text-red-400 border-red-500/20',
      running: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      waiting: 'bg-brand/10 text-brand border-brand/20',
    }
    const icons = { success: CheckCircle2, error: XCircle, running: RefreshCw, waiting: Clock }
    const labels = { success: 'OK', error: 'Erro', running: 'Rodando', waiting: 'Aguardando' }
    const Icon = icons[status]
    const cls = map[status] || 'bg-white/[0.04] text-gray-500 border-white/[0.06]'
    return (
      <span className={`text-[11px] border px-2 py-0.5 rounded-full font-medium ${cls}`}>
        {Icon && <Icon className="w-3 h-3 inline mr-1" />}{labels[status] || status}
      </span>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.04] text-gray-600 text-[11px] uppercase tracking-wider">
            <th className="px-6 py-3 text-left font-semibold">ID</th>
            <th className="px-6 py-3 text-left font-semibold">Inicio</th>
            <th className="px-6 py-3 text-left font-semibold">Duracao</th>
            <th className="px-6 py-3 text-left font-semibold">Modo</th>
            <th className="px-6 py-3 text-left font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.03]">
          {executions.map(e => (
            <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
              <td className="px-6 py-3 text-gray-500 font-mono text-xs">{e.id}</td>
              <td className="px-6 py-3 text-gray-400 font-mono text-xs">{formatDateTime(e.inicio)}</td>
              <td className="px-6 py-3 text-gray-500 font-mono text-xs">{e.duracao != null ? `${e.duracao}s` : '--'}</td>
              <td className="px-6 py-3 text-gray-600 capitalize text-xs">{e.modo || '--'}</td>
              <td className="px-6 py-3"><StatusBadge status={e.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
