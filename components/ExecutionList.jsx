export default function ExecutionList({ executions }) {
  if (!executions?.length) {
    return <p className="text-gray-500 text-sm text-center py-12">Nenhuma execução encontrada.</p>
  }

  function formatDateTime(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  function StatusBadge({ status }) {
    const map = {
      success: 'bg-green-900/40 text-green-400 border-green-800',
      error: 'bg-red-900/40 text-red-400 border-red-800',
      running: 'bg-yellow-900/40 text-yellow-400 border-yellow-800',
      waiting: 'bg-blue-900/40 text-blue-400 border-blue-800',
    }
    const labels = { success: '✓ Sucesso', error: '✗ Erro', running: '⟳ Executando', waiting: '⏳ Aguardando' }
    const cls = map[status] || 'bg-gray-800 text-gray-400 border-gray-700'
    return (
      <span className={`text-xs border px-2 py-0.5 rounded-full font-medium ${cls}`}>
        {labels[status] || status}
      </span>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-500 text-xs">
            <th className="px-6 py-3 text-left font-medium">ID</th>
            <th className="px-6 py-3 text-left font-medium">Início</th>
            <th className="px-6 py-3 text-left font-medium">Duração</th>
            <th className="px-6 py-3 text-left font-medium">Modo</th>
            <th className="px-6 py-3 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {executions.map(e => (
            <tr key={e.id} className="hover:bg-gray-800/30 transition">
              <td className="px-6 py-3 text-gray-400 font-mono text-xs">{e.id}</td>
              <td className="px-6 py-3 text-gray-300">{formatDateTime(e.inicio)}</td>
              <td className="px-6 py-3 text-gray-400">{e.duracao != null ? `${e.duracao}s` : '—'}</td>
              <td className="px-6 py-3 text-gray-500 capitalize">{e.modo || '—'}</td>
              <td className="px-6 py-3"><StatusBadge status={e.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
