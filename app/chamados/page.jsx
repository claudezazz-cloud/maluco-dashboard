'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { Ticket, Users, Loader2, FileSpreadsheet, CheckCircle2, RefreshCw } from 'lucide-react'

function formatTTL(seconds) {
  if (!seconds || seconds < 0) return 'Expirado'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m restantes`
}

export default function ChamadosPage() {
  const router = useRouter()
  const chamadosFileRef = useRef(null)
  const clientesFileRef = useRef(null)
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('chamados')

  // ===== CHAMADOS =====
  const [chamadosStatus, setChamadosStatus] = useState(null)
  const [loadingChamados, setLoadingChamados] = useState(true)
  const [uploadingChamados, setUploadingChamados] = useState(false)
  const [previewChamados, setPreviewChamados] = useState(null)
  const [msgChamados, setMsgChamados] = useState({ texto: '', tipo: '' })
  const [dragOverChamados, setDragOverChamados] = useState(false)

  // ===== RESOLVIDOS HOJE =====
  const [resolvidos, setResolvidos] = useState(null)
  const [loadingResolvidos, setLoadingResolvidos] = useState(false)

  // ===== CLIENTES =====
  const [clientesStatus, setClientesStatus] = useState(null)
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [uploadingClientes, setUploadingClientes] = useState(false)
  const [previewClientes, setPreviewClientes] = useState(null)
  const [msgClientes, setMsgClientes] = useState({ texto: '', tipo: '' })
  const [dragOverClientes, setDragOverClientes] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) { router.push('/login'); return null }
      return r.json()
    }).then(d => {
      if (!d) return
      setUser(d)
    })
    fetchChamadosStatus()
    fetchClientesStatus()
    fetchResolvidos()
  }, [router])

  async function fetchResolvidos() {
    setLoadingResolvidos(true)
    try {
      const r = await fetch('/api/chamados/resolvidos-hoje?detalhes=1')
      if (r.ok) setResolvidos(await r.json())
    } catch {}
    setLoadingResolvidos(false)
  }

  // ===== CHAMADOS FUNCS =====
  async function fetchChamadosStatus() {
    setLoadingChamados(true)
    try {
      const r = await fetch('/api/chamados')
      if (r.ok) setChamadosStatus(await r.json())
    } catch {}
    setLoadingChamados(false)
  }

  function showMsgChamados(texto, tipo = 'success') {
    setMsgChamados({ texto, tipo })
    setTimeout(() => setMsgChamados({ texto: '', tipo: '' }), 5000)
  }

  async function parseXLSX(file) {
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const sheetName = wb.SheetNames.length > 1 ? wb.SheetNames[1] : wb.SheetNames[0]
    const sheet = wb.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    if (jsonData.length < 2) throw new Error('Planilha vazia ou sem dados')
    const headers = jsonData[0].map(h => String(h || '').trim())
    const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== ''))
    return { headers, rows, totalRows: rows.length }
  }

  async function handleChamadosFile(file) {
    if (!file) return
    if (!file.name.match(/\.xlsx?$/i)) { showMsgChamados('Apenas arquivos .xlsx sao aceitos', 'error'); return }
    try {
      setUploadingChamados(true)
      const data = await parseXLSX(file)
      setPreviewChamados(data)
      showMsgChamados(`Planilha carregada: ${data.totalRows} chamados encontrados`)
    } catch (e) {
      showMsgChamados('Erro ao ler planilha: ' + e.message, 'error')
    } finally {
      setUploadingChamados(false)
    }
  }

  async function enviarChamados() {
    if (!previewChamados) return
    setUploadingChamados(true)
    try {
      const r = await fetch('/api/chamados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers: previewChamados.headers, chamados: previewChamados.rows }),
      })
      const d = await r.json()
      if (r.ok) {
        showMsgChamados(`${d.total} chamados enviados para o bot! Validos por 24h.`)
        setPreviewChamados(null)
        fetchChamadosStatus()
      } else {
        showMsgChamados('Erro: ' + (d.error || r.status), 'error')
      }
    } catch (e) {
      showMsgChamados('Erro: ' + e.message, 'error')
    } finally {
      setUploadingChamados(false)
    }
  }

  async function limparChamados() {
    if (!confirm('Remover chamados do bot?')) return
    await fetch('/api/chamados', { method: 'DELETE' })
    showMsgChamados('Chamados removidos do bot.')
    setChamadosStatus(null)
    fetchChamadosStatus()
  }

  async function limparHistorico() {
    if (!confirm('Limpar todo o historico de conversas do bot? Isso apaga as mensagens anteriores de todas as conversas no Redis.')) return
    try {
      const r = await fetch('/api/historico', { method: 'DELETE' })
      const d = await r.json()
      if (r.ok) showMsgChamados(`Historico limpo! ${d.removidas} conversas removidas.`)
      else showMsgChamados('Erro: ' + (d.error || r.status), 'error')
    } catch (e) {
      showMsgChamados('Erro: ' + e.message, 'error')
    }
  }

  // ===== CLIENTES FUNCS =====
  async function fetchClientesStatus() {
    setLoadingClientes(true)
    try {
      const r = await fetch('/api/clientes')
      if (r.ok) setClientesStatus(await r.json())
    } catch {}
    setLoadingClientes(false)
  }

  function showMsgClientes(texto, tipo = 'success') {
    setMsgClientes({ texto, tipo })
    setTimeout(() => setMsgClientes({ texto: '', tipo: '' }), 5000)
  }

  async function handleClientesFile(file) {
    if (!file) return
    if (!file.name.match(/\.xlsx?$/i)) { showMsgClientes('Apenas arquivos .xlsx sao aceitos', 'error'); return }
    try {
      setUploadingClientes(true)
      const data = await parseXLSX(file)
      setPreviewClientes(data)
      showMsgClientes(`Planilha carregada: ${data.totalRows} clientes encontrados`)
    } catch (e) {
      showMsgClientes('Erro ao ler planilha: ' + e.message, 'error')
    } finally {
      setUploadingClientes(false)
    }
  }

  async function enviarClientes() {
    if (!previewClientes) return
    setUploadingClientes(true)
    try {
      const r = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers: previewClientes.headers, clientes: previewClientes.rows }),
      })
      const d = await r.json()
      if (r.ok) {
        showMsgClientes(`${d.total} clientes enviados para o bot!`)
        setPreviewClientes(null)
        fetchClientesStatus()
      } else {
        showMsgClientes('Erro: ' + (d.error || r.status), 'error')
      }
    } catch (e) {
      showMsgClientes('Erro: ' + e.message, 'error')
    } finally {
      setUploadingClientes(false)
    }
  }

  async function limparClientes() {
    if (!confirm('Remover lista de clientes do bot?')) return
    await fetch('/api/clientes', { method: 'DELETE' })
    showMsgClientes('Clientes removidos do bot.')
    setClientesStatus(null)
    fetchClientesStatus()
  }

  // ===== PREVIEW TABLE COMPONENT =====
  function PreviewTable({ preview }) {
    return (
      <div className="bg-surface-raised rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {preview.headers.slice(0, 12).map((h, i) => (
                  <th key={i} className="text-left text-gray-400 font-medium px-3 py-2 whitespace-nowrap">
                    {h || `Col ${i + 1}`}
                  </th>
                ))}
                {preview.headers.length > 12 && (
                  <th className="text-gray-600 px-3 py-2">+{preview.headers.length - 12} cols</th>
                )}
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 10).map((row, ri) => (
                <tr key={ri} className="border-b border-white/[0.06]/50 hover:bg-gray-800/20">
                  {row.slice(0, 12).map((cell, ci) => (
                    <td key={ci} className="text-gray-300 px-3 py-2 whitespace-nowrap max-w-[200px] truncate">
                      {cell !== null && cell !== undefined ? String(cell) : ''}
                    </td>
                  ))}
                  {preview.headers.length > 12 && (
                    <td className="text-gray-600 px-3 py-2">...</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {preview.totalRows > 10 && (
          <div className="px-3 py-2 border-t border-white/[0.06] text-gray-500 text-xs">
            Mostrando 10 de {preview.totalRows} linhas
          </div>
        )}
      </div>
    )
  }

  const tabs = [
    { id: 'chamados', label: <span className="flex items-center gap-1"><Ticket className="w-3.5 h-3.5" /> Chamados</span>, badge: chamadosStatus?.ativo ? chamadosStatus.total : null },
    { id: 'resolvidos', label: <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Resolvidos hoje</span>, badge: resolvidos?.total_resolvidos || null },
    { id: 'clientes', label: <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Clientes</span>, badge: clientesStatus?.ativo ? clientesStatus.total : null },
  ]

  return (
    <div className="min-h-screen bg-surface">
      <Navbar user={user} />
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Dados & Importações</h1>
          <p className="text-gray-400 text-sm mt-1">Chamados e clientes importados para o bot</p>
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
              {t.badge && (
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  tab === t.id ? 'bg-green-700' : 'bg-gray-800'
                }`}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ==================== ABA CHAMADOS ==================== */}
        {tab === 'chamados' && (
          <>
            {msgChamados.texto && (
              <div className={`mb-4 text-sm px-4 py-2.5 rounded-lg border ${msgChamados.tipo === 'error' ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-green-900/20 border-green-800 text-brand'}`}>
                {msgChamados.texto}
              </div>
            )}

            {/* Status atual */}
            {!loadingChamados && chamadosStatus?.ativo && (
              <div className="bg-surface-raised rounded-xl border border-brand/20/40 p-5 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-brand font-medium text-sm">Chamados ativos no bot</span>
                    </div>
                    <p className="text-white text-lg font-bold">{chamadosStatus.total} chamados</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Importado em {chamadosStatus.importado_em} — {formatTTL(chamadosStatus.expira_em_segundos)}
                    </p>
                  </div>
                  <button onClick={limparChamados}
                    className="text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/30 px-3 py-1.5 rounded-lg transition">
                    Remover
                  </button>
                </div>
                {chamadosStatus.resumo && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Resumo</p>
                    <pre className="text-gray-300 text-xs whitespace-pre-wrap font-sans leading-relaxed">{chamadosStatus.resumo}</pre>
                  </div>
                )}
              </div>
            )}

            {/* Limpar histórico — admin only */}
            {user?.role === 'admin' && (
              <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-5 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium text-sm">Historico de conversas</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      Limpe o historico se o bot estiver repetindo respostas antigas ou contagens erradas
                    </p>
                  </div>
                  <button onClick={limparHistorico}
                    className="text-xs text-yellow-400 hover:text-yellow-300 bg-yellow-900/20 hover:bg-yellow-900/30 px-3 py-1.5 rounded-lg transition">
                    Limpar Historico
                  </button>
                </div>
              </div>
            )}

            {/* Upload area */}
            <div
              className={`bg-surface-raised rounded-xl border-2 border-dashed p-12 text-center transition cursor-pointer ${
                dragOverChamados ? 'border-[#008000] bg-brand/5' : 'border-gray-700 hover:border-gray-600'
              }`}
              onClick={() => chamadosFileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOverChamados(true) }}
              onDragLeave={() => setDragOverChamados(false)}
              onDrop={e => { e.preventDefault(); setDragOverChamados(false); handleChamadosFile(e.dataTransfer?.files?.[0]) }}
            >
              <input ref={chamadosFileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => handleChamadosFile(e.target.files?.[0])} />
              <div className="mb-3">{uploadingChamados ? <Loader2 className="w-10 h-10 text-gray-600 mx-auto animate-spin" /> : <FileSpreadsheet className="w-10 h-10 text-gray-600 mx-auto" />}</div>
              <p className="text-white font-medium">
                {uploadingChamados ? 'Lendo planilha...' : 'Clique ou arraste a planilha XLSX aqui'}
              </p>
              <p className="text-gray-500 text-sm mt-1">Planilha de chamados exportada do sistema (IXC, SGP, etc)</p>
            </div>

            {/* Preview */}
            {previewChamados && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-white font-medium">Preview da planilha</h2>
                    <p className="text-gray-400 text-sm">{previewChamados.totalRows} chamados — {previewChamados.headers.length} colunas</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setPreviewChamados(null)}
                      className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition">Cancelar</button>
                    <button onClick={enviarChamados} disabled={uploadingChamados}
                      className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-sm px-6 py-2 rounded-lg transition font-medium">
                      {uploadingChamados ? 'Enviando...' : `Enviar ${previewChamados.totalRows} chamados`}
                    </button>
                  </div>
                </div>
                <PreviewTable preview={previewChamados} />
              </div>
            )}

            {/* Como funciona */}
            <div className="mt-8 bg-surface-raised rounded-xl border border-white/[0.06] p-5">
              <h3 className="text-white font-medium mb-3">Como funciona</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <p><span className="text-brand">1.</span> Exporte a planilha de chamados do seu sistema em formato <strong className="text-white">.xlsx</strong></p>
                <p><span className="text-brand">2.</span> Importe aqui — a planilha sera processada e enviada para o bot</p>
                <p><span className="text-brand">3.</span> Pergunte no WhatsApp: <em className="text-gray-300">"quantos chamados abertos?", "chamados do bairro Centro?"</em></p>
                <p><span className="text-brand">4.</span> Os dados ficam disponiveis por <strong className="text-white">24 horas</strong>, depois expiram automaticamente</p>
              </div>
            </div>
          </>
        )}

        {/* ==================== ABA RESOLVIDOS HOJE ==================== */}
        {tab === 'resolvidos' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-white font-medium text-lg">Chamados resolvidos hoje</h2>
                <p className="text-gray-500 text-xs mt-0.5">
                  Calculado por diferença entre snapshots — chamado que aparecia em algum momento hoje e sumiu do snapshot mais recente.
                </p>
              </div>
              <button
                onClick={fetchResolvidos}
                disabled={loadingResolvidos}
                className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingResolvidos ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>

            {loadingResolvidos && !resolvidos && (
              <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-12 text-center">
                <Loader2 className="w-8 h-8 text-gray-600 mx-auto animate-spin" />
              </div>
            )}

            {resolvidos && resolvidos.total_resolvidos === 0 && (
              <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Nenhum chamado resolvido hoje ainda.</p>
                <p className="text-gray-500 text-xs mt-1">Snapshots começam em :05 de cada hora — espere mais algumas execuções.</p>
              </div>
            )}

            {resolvidos && resolvidos.total_resolvidos > 0 && (
              <>
                <div className="bg-surface-raised rounded-xl border border-brand/20 p-5 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-brand" />
                    </div>
                    <div>
                      <p className="text-white text-2xl font-bold leading-tight">{resolvidos.total_resolvidos}</p>
                      <p className="text-gray-400 text-xs">chamados resolvidos hoje</p>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-raised rounded-xl border border-white/[0.06] overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/[0.06]">
                    <p className="text-white text-sm font-medium">Ranking por técnico</p>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {resolvidos.ranking.map((r, idx) => (
                      <details key={r.usuario} className="group">
                        <summary className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] list-none">
                          <div className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                              idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                              idx === 2 ? 'bg-orange-700/30 text-orange-400' :
                              'bg-gray-800 text-gray-500'
                            }`}>{idx + 1}</span>
                            <span className="text-white font-mono text-sm">{r.usuario}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-brand font-bold text-sm">{r.total}</span>
                            <span className="text-gray-500 text-xs">chamado{r.total > 1 ? 's' : ''}</span>
                          </div>
                        </summary>
                        <div className="px-5 pb-3 pt-1 bg-black/20">
                          <table className="w-full text-xs text-gray-400">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="text-left py-1.5 font-medium">#Numero</th>
                                <th className="text-left py-1.5 font-medium">Cliente</th>
                                <th className="text-left py-1.5 font-medium">Bairro</th>
                                <th className="text-left py-1.5 font-medium">Tipo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.chamados.map(c => (
                                <tr key={c.numero} className="border-t border-white/[0.03]">
                                  <td className="py-1.5 font-mono text-gray-500">#{c.numero}</td>
                                  <td className="py-1.5 text-gray-300">{c.cod_cliente ? `${c.cod_cliente} - ` : ''}{c.cliente || '-'}</td>
                                  <td className="py-1.5">{c.bairro || '-'}</td>
                                  <td className="py-1.5">{c.tipo || '-'}{c.topico ? ` / ${c.topico}` : ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>

                <div className="mt-4 text-xs text-gray-500">
                  <p>Texto enviado pro bot quando alguém pergunta no WhatsApp:</p>
                  <pre className="mt-1 bg-black/40 border border-white/[0.06] rounded-lg p-3 whitespace-pre-wrap font-mono text-gray-400">{resolvidos.ai_text}</pre>
                </div>
              </>
            )}
          </>
        )}

        {/* ==================== ABA CLIENTES ==================== */}
        {tab === 'clientes' && (
          <>
            {msgClientes.texto && (
              <div className={`mb-4 text-sm px-4 py-2.5 rounded-lg border ${msgClientes.tipo === 'error' ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-green-900/20 border-green-800 text-brand'}`}>
                {msgClientes.texto}
              </div>
            )}

            {/* Status atual */}
            {!loadingClientes && clientesStatus?.ativo && (
              <div className="bg-surface-raised rounded-xl border border-brand/20/40 p-5 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-brand font-medium text-sm">Clientes ativos no bot</span>
                    </div>
                    <p className="text-white text-lg font-bold">{clientesStatus.total} clientes</p>
                    <p className="text-gray-400 text-xs mt-1">Importado em {clientesStatus.importado_em}</p>
                  </div>
                  {user?.role === 'admin' && (
                    <button onClick={limparClientes}
                      className="text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/30 px-3 py-1.5 rounded-lg transition">
                      Remover
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Upload area — admin only */}
            {user?.role === 'admin' && (
              <>
                <div
                  className={`bg-surface-raised rounded-xl border-2 border-dashed p-12 text-center transition cursor-pointer ${
                    dragOverClientes ? 'border-[#008000] bg-brand/5' : 'border-gray-700 hover:border-gray-600'
                  }`}
                  onClick={() => clientesFileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOverClientes(true) }}
                  onDragLeave={() => setDragOverClientes(false)}
                  onDrop={e => { e.preventDefault(); setDragOverClientes(false); handleClientesFile(e.dataTransfer?.files?.[0]) }}
                >
                  <input ref={clientesFileRef} type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={e => handleClientesFile(e.target.files?.[0])} />
                  <div className="mb-3">{uploadingClientes ? <Loader2 className="w-10 h-10 text-gray-600 mx-auto animate-spin" /> : <Users className="w-10 h-10 text-gray-600 mx-auto" />}</div>
                  <p className="text-white font-medium">
                    {uploadingClientes ? 'Lendo planilha...' : 'Clique ou arraste a planilha XLSX aqui'}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">Planilha com colunas Cod e Nome (exportada do IXC, SGP, etc)</p>
                </div>

                {/* Preview */}
                {previewClientes && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-white font-medium">Preview da planilha</h2>
                        <p className="text-gray-400 text-sm">{previewClientes.totalRows} clientes — {previewClientes.headers.length} colunas</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setPreviewClientes(null)}
                          className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition">Cancelar</button>
                        <button onClick={enviarClientes} disabled={uploadingClientes}
                          className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-sm px-6 py-2 rounded-lg transition font-medium">
                          {uploadingClientes ? 'Enviando...' : `Enviar ${previewClientes.totalRows} clientes`}
                        </button>
                      </div>
                    </div>
                    <PreviewTable preview={previewClientes} />
                  </div>
                )}
              </>
            )}

            {/* Como funciona */}
            <div className="mt-8 bg-surface-raised rounded-xl border border-white/[0.06] p-5">
              <h3 className="text-white font-medium mb-3">Como funciona</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <p><span className="text-brand">1.</span> Exporte a lista de clientes do seu sistema em formato <strong className="text-white">.xlsx</strong></p>
                <p><span className="text-brand">2.</span> A planilha deve ter pelo menos as colunas <strong className="text-white">Cod</strong> e <strong className="text-white">Nome</strong></p>
                <p><span className="text-brand">3.</span> O bot passara a reconhecer os clientes quando mencionados no WhatsApp</p>
                <p><span className="text-brand">4.</span> Os dados ficam disponiveis <strong className="text-white">permanentemente</strong> ate serem removidos ou substituidos</p>
              </div>
            </div>
          </>
        )}

      </main>
    </div>
  )
}
