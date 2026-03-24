export default function StatusCard({ filial, selected, onSelect }) {
  const { nome, online, workflowNome, ultimaExecucao, errosHoje, mensagensHoje } = filial

  function formatTime(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    const hoje = new Date()
    if (d.toDateString() === hoje.toDateString()) return `Hoje às ${formatTime(iso)}`
    return d.toLocaleDateString('pt-BR') + ' ' + formatTime(iso)
  }

  const statusColor = ultimaExecucao?.status === 'success' ? 'text-green-400'
    : ultimaExecucao?.status === 'error' ? 'text-red-400'
    : ultimaExecucao?.status === 'running' ? 'text-yellow-400'
    : 'text-gray-500'

  const statusLabel = ultimaExecucao?.status === 'success' ? '✓ Sucesso'
    : ultimaExecucao?.status === 'error' ? '✗ Erro'
    : ultimaExecucao?.status === 'running' ? '⟳ Executando'
    : '—'

  return (
    <div
      onClick={onSelect}
      className={`bg-[#1a1a24] rounded-xl border p-5 cursor-pointer transition hover:border-[#071DE3] ${selected ? 'border-[#071DE3]' : 'border-gray-800'}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold">{nome}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{workflowNome || 'Sem workflow'}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500 shadow-[0_0_6px_#22c55e]' : 'bg-red-500'}`} />
          <span className={`text-sm font-medium ${online ? 'text-green-400' : 'text-red-400'}`}>
            {online ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0f0f13] rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Mensagens hoje</p>
          <p className="text-xl font-bold text-white">{mensagensHoje}</p>
        </div>
        <div className="bg-[#0f0f13] rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Erros hoje</p>
          <p className={`text-xl font-bold ${errosHoje > 0 ? 'text-red-400' : 'text-white'}`}>{errosHoje}</p>
        </div>
      </div>

      {ultimaExecucao && (
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-gray-500">{formatDate(ultimaExecucao.inicio)}</span>
          <span className={`font-medium ${statusColor}`}>{statusLabel}</span>
        </div>
      )}
    </div>
  )
}
