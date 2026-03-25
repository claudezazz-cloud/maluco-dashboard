'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

function formatTTL(seconds) {
  if (!seconds || seconds < 0) return 'Expirado'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m restantes`
}

export default function ChamadosPage() {
  const router = useRouter()
  const fileRef = useRef(null)
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [msg, setMsg] = useState({ texto: '', tipo: '' })
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) { router.push('/login'); return null }
      return r.json()
    }).then(d => {
      if (!d) return
      if (d.role !== 'admin') { router.push('/dashboard'); return }
      setUser(d)
    })
    fetchStatus()
  }, [router])

  async function fetchStatus() {
    setLoading(true)
    try {
      const r = await fetch('/api/chamados')
      if (r.ok) setStatus(await r.json())
    } catch {}
    setLoading(false)
  }

  function showMsg(texto, tipo = 'success') {
    setMsg({ texto, tipo })
    setTimeout(() => setMsg({ texto: '', tipo: '' }), 5000)
  }

  async function parseXLSX(file) {
    // Importa xlsx dinamicamente (so carrega quando precisa)
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

    if (jsonData.length < 2) {
      throw new Error('Planilha vazia ou sem dados')
    }

    const headers = jsonData[0].map(h => String(h || '').trim())
    const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== ''))

    return { headers, rows, totalRows: rows.length }
  }

  async function handleFile(file) {
    if (!file) return
    if (!file.name.match(/\.xlsx?$/i)) {
      showMsg('Apenas arquivos .xlsx sao aceitos', 'error')
      return
    }

    try {
      setUploading(true)
      const data = await parseXLSX(file)
      setPreview(data)
      showMsg(`Planilha carregada: ${data.totalRows} chamados encontrados`)
    } catch (e) {
      showMsg('Erro ao ler planilha: ' + e.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) handleFile(file)
  }

  async function enviarParaBot() {
    if (!preview) return
    setUploading(true)
    try {
      const r = await fetch('/api/chamados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers: preview.headers, chamados: preview.rows }),
      })
      const d = await r.json()
      if (r.ok) {
        showMsg(`${d.total} chamados enviados para o bot! Validos por 24h.`)
        setPreview(null)
        fetchStatus()
      } else {
        showMsg('Erro: ' + (d.error || r.status), 'error')
      }
    } catch (e) {
      showMsg('Erro: ' + e.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  async function limparChamados() {
    if (!confirm('Remover chamados do bot?')) return
    await fetch('/api/chamados', { method: 'DELETE' })
    showMsg('Chamados removidos do bot.')
    setStatus(null)
    fetchStatus()
  }

  return (
    <div className="min-h-screen bg-[#0f0f13]">
      <Navbar user={user} />
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">🎫 Chamados</h1>
            <p className="text-gray-400 text-sm mt-1">Importe planilha XLSX para o bot responder perguntas sobre chamados</p>
          </div>
        </div>

        {msg.texto && (
          <div className={`mb-4 text-sm px-4 py-2.5 rounded-lg border ${msg.tipo === 'error' ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-green-900/20 border-green-800 text-green-400'}`}>
            {msg.texto}
          </div>
        )}

        {/* Status atual */}
        {!loading && status?.ativo && (
          <div className="bg-[#1a1a24] rounded-xl border border-green-900/40 p-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-400 font-medium text-sm">Chamados ativos no bot</span>
                </div>
                <p className="text-white text-lg font-bold">{status.total} chamados</p>
                <p className="text-gray-400 text-xs mt-1">
                  Importado em {status.importado_em} — {formatTTL(status.expira_em_segundos)}
                </p>
              </div>
              <button
                onClick={limparChamados}
                className="text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/30 px-3 py-1.5 rounded-lg transition"
              >
                Remover
              </button>
            </div>

            {status.resumo && (
              <div className="mt-3 pt-3 border-t border-gray-800">
                <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Resumo</p>
                <pre className="text-gray-300 text-xs whitespace-pre-wrap font-sans leading-relaxed">{status.resumo}</pre>
              </div>
            )}
          </div>
        )}

        {/* Upload area */}
        <div
          className={`bg-[#1a1a24] rounded-xl border-2 border-dashed p-12 text-center transition cursor-pointer ${
            dragOver
              ? 'border-[#071DE3] bg-[#071DE3]/5'
              : 'border-gray-700 hover:border-gray-600'
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => handleFile(e.target.files?.[0])}
          />
          <div className="text-4xl mb-3">{uploading ? '⏳' : '📊'}</div>
          <p className="text-white font-medium">
            {uploading ? 'Lendo planilha...' : 'Clique ou arraste a planilha XLSX aqui'}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Planilha de chamados exportada do sistema (IXC, SGP, etc)
          </p>
        </div>

        {/* Preview */}
        {preview && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-white font-medium">Preview da planilha</h2>
                <p className="text-gray-400 text-sm">{preview.totalRows} chamados encontrados — {preview.headers.length} colunas</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreview(null)}
                  className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={enviarParaBot}
                  disabled={uploading}
                  className="bg-[#071DE3] hover:bg-[#0516B0] disabled:opacity-40 text-white text-sm px-6 py-2 rounded-lg transition font-medium"
                >
                  {uploading ? 'Enviando...' : `Enviar ${preview.totalRows} chamados para o Bot`}
                </button>
              </div>
            </div>

            {/* Tabela preview (primeiras 10 linhas) */}
            <div className="bg-[#1a1a24] rounded-xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
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
                      <tr key={ri} className="border-b border-gray-800/50 hover:bg-gray-800/20">
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
                <div className="px-3 py-2 border-t border-gray-800 text-gray-500 text-xs">
                  Mostrando 10 de {preview.totalRows} linhas
                </div>
              )}
            </div>
          </div>
        )}

        {/* Como funciona */}
        <div className="mt-8 bg-[#1a1a24] rounded-xl border border-gray-800 p-5">
          <h3 className="text-white font-medium mb-3">Como funciona</h3>
          <div className="space-y-2 text-sm text-gray-400">
            <p><span className="text-blue-400">1.</span> Exporte a planilha de chamados do seu sistema (IXC, SGP, etc) em formato <strong className="text-white">.xlsx</strong></p>
            <p><span className="text-blue-400">2.</span> Importe aqui — a planilha sera processada e enviada para o bot</p>
            <p><span className="text-blue-400">3.</span> Pergunte no WhatsApp: <em className="text-gray-300">"quantos chamados abertos tem?", "quais chamados do bairro Centro?", "tem algum chamado agendado pra hoje?"</em></p>
            <p><span className="text-blue-400">4.</span> Os dados ficam disponiveis por <strong className="text-white">24 horas</strong>, depois expiram automaticamente</p>
          </div>
        </div>

      </main>
    </div>
  )
}
