'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { Send, ImagePlus, Trash2, Loader2, X } from 'lucide-react'

function fmtHora(iso) {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

export default function ChatPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [imagem, setImagem] = useState(null)
  const [sending, setSending] = useState(false)
  const [aguardandoBot, setAguardandoBot] = useState(false)
  const [erro, setErro] = useState('')
  const scrollRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) { router.push('/login'); return }
      setUser(d)
    })
  }, [router])

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/chat/messages')
      if (!r.ok) return
      const d = await r.json()
      const items = []
      for (const m of d.mensagens || []) {
        items.push({ key: 'm' + m.id, tipo: 'user', texto: m.mensagem, hora: m.data_hora, remetente: m.remetente })
      }
      for (const c of d.conversas || []) {
        items.push({ key: 'c' + c.id, tipo: 'bot', texto: c.resposta, hora: c.criado_em, pops: c.pops_usados, tokensIn: c.tokens_input, tokensOut: c.tokens_output })
      }
      items.sort((a, b) => new Date(a.hora) - new Date(b.hora))
      setMensagens(items)
      if (items.length && items[items.length - 1].tipo === 'bot') setAguardandoBot(false)
    } catch {}
  }, [])

  useEffect(() => {
    if (!user) return
    carregar()
    const iv = setInterval(carregar, 2000)
    return () => clearInterval(iv)
  }, [user, carregar])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [mensagens])

  async function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { setErro('Imagem maior que 5MB'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      const base64 = dataUrl.split(',')[1]
      setImagem({ base64, mimetype: f.type || 'image/jpeg', preview: dataUrl })
    }
    reader.readAsDataURL(f)
    e.target.value = ''
  }

  async function enviar() {
    if (sending) return
    if (!texto.trim() && !imagem) return
    setSending(true)
    setErro('')
    try {
      let body
      if (imagem) {
        body = { tipo: 'image', imageBase64: imagem.base64, imageMimetype: imagem.mimetype, caption: texto || '' }
      } else {
        body = { tipo: 'text', texto }
      }
      const r = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Falha ao enviar')
      setTexto('')
      setImagem(null)
      setAguardandoBot(true)
      setTimeout(carregar, 600)
    } catch (e) {
      setErro(e.message)
    } finally {
      setSending(false)
    }
  }

  async function limpar() {
    if (!confirm('Apagar todo o historico deste chat?')) return
    await fetch('/api/chat/messages', { method: 'DELETE' })
    setMensagens([])
  }

  if (!user) return <div className="min-h-screen bg-[#08080c]" />

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col">
      <Navbar user={user} />

      <main className="max-w-3xl mx-auto w-full flex-1 flex flex-col px-4 py-5 gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-white tracking-tight">Chat com o Maluco</h1>
            <p className="text-[11px] text-gray-600 mt-0.5">Teste o bot diretamente pela dashboard.</p>
          </div>
          <button onClick={limpar} className="flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-red-400 bg-white/[0.02] hover:bg-red-500/[0.06] border border-white/[0.04] px-3 py-1.5 rounded-lg transition-all duration-200">
            <Trash2 className="w-3 h-3" /> Limpar
          </button>
        </div>

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 bg-surface-raised/60 border border-white/[0.04] rounded-2xl p-4 overflow-y-auto" style={{ minHeight: '400px', maxHeight: 'calc(100vh - 260px)' }}>
          {mensagens.length === 0 && (
            <div className="h-full flex items-center justify-center text-gray-700 text-sm">
              Nenhuma mensagem ainda.
            </div>
          )}
          <div className="space-y-3">
            {mensagens.map(m => (
              <div key={m.key} className={`flex ${m.tipo === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  m.tipo === 'user'
                    ? 'bg-brand/20 text-white border border-brand/20'
                    : 'bg-white/[0.04] text-gray-200 border border-white/[0.06]'
                }`}>
                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{m.texto}</p>
                  <div className={`flex items-center gap-2 mt-1.5 text-[10px] ${m.tipo === 'user' ? 'text-brand/50' : 'text-gray-600'}`}>
                    <span className="font-mono">{fmtHora(m.hora)}</span>
                    {m.pops && <span className="truncate max-w-[200px]" title={m.pops}>POPs: {m.pops.split(',').length}</span>}
                    {m.tokensIn != null && (m.tokensIn + m.tokensOut) > 0 && (
                      <span className="font-mono">{(m.tokensIn + m.tokensOut).toLocaleString()} tok</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {aguardandoBot && (
              <div className="flex justify-start">
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-2.5 flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-brand/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-brand/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-brand/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-gray-500">Pensando...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Image preview */}
        {imagem && (
          <div className="bg-surface-raised/60 border border-white/[0.04] rounded-xl p-3 flex items-center gap-3">
            <img src={imagem.preview} alt="preview" className="w-14 h-14 object-cover rounded-lg border border-white/[0.06]" />
            <div className="flex-1 text-xs text-gray-500">Imagem pronta. Legenda opcional.</div>
            <button onClick={() => setImagem(null)} className="text-gray-600 hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
          </div>
        )}

        {erro && <div className="text-xs text-red-400 bg-red-500/[0.08] border border-red-500/20 rounded-lg px-3 py-2">{erro}</div>}

        {/* Input area */}
        <div className="flex items-end gap-2 bg-surface-raised/80 border border-white/[0.06] rounded-2xl p-2">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          <button
            onClick={() => fileRef.current?.click()}
            className="p-2.5 text-gray-600 hover:text-brand hover:bg-brand/[0.06] rounded-lg transition-all duration-200"
            title="Anexar imagem"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
            placeholder={imagem ? 'Legenda ou pergunta...' : 'Digite uma mensagem...'}
            rows={1}
            className="flex-1 bg-transparent text-white text-sm resize-none outline-none px-2 py-2 max-h-32 placeholder:text-gray-700"
            style={{ minHeight: '40px' }}
          />
          <button
            onClick={enviar}
            disabled={sending || (!texto.trim() && !imagem)}
            className="p-2.5 bg-brand hover:bg-brand-dark disabled:bg-white/[0.04] disabled:text-gray-700 text-white rounded-lg transition-all duration-200"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </main>
    </div>
  )
}
