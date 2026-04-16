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
  const [imagem, setImagem] = useState(null) // { base64, mimetype, preview }
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
      // Monta timeline combinando mensagem do usuário (mensagens) e respostas do bot (bot_conversas)
      const items = []
      for (const m of d.mensagens || []) {
        items.push({
          key: 'm' + m.id,
          tipo: 'user',
          texto: m.mensagem,
          hora: m.data_hora,
          remetente: m.remetente
        })
      }
      for (const c of d.conversas || []) {
        items.push({
          key: 'c' + c.id,
          tipo: 'bot',
          texto: c.resposta,
          hora: c.criado_em,
          pops: c.pops_usados,
          tokensIn: c.tokens_input,
          tokensOut: c.tokens_output
        })
      }
      items.sort((a, b) => new Date(a.hora) - new Date(b.hora))
      setMensagens(items)
      // Se a última mensagem é do bot, para o spinner
      if (items.length && items[items.length - 1].tipo === 'bot') setAguardandoBot(false)
    } catch (e) { /* ignore */ }
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
    if (!confirm('Apagar todo o histórico deste chat?')) return
    await fetch('/api/chat/messages', { method: 'DELETE' })
    setMensagens([])
  }

  if (!user) return <div className="min-h-screen bg-[#0f0f13]" />

  return (
    <div className="min-h-screen bg-[#0f0f13] text-white flex flex-col">
      <Navbar user={user} />

      <main className="max-w-3xl mx-auto w-full flex-1 flex flex-col px-4 py-4 gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Chat com o Maluco</h1>
            <p className="text-xs text-gray-500">Teste o bot diretamente pela dashboard.</p>
          </div>
          <button onClick={limpar} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-400 bg-gray-800/50 hover:bg-red-900/30 px-3 py-1.5 rounded-lg transition">
            <Trash2 className="w-3.5 h-3.5" /> Limpar histórico
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 bg-[#1a1a24] border border-gray-800 rounded-xl p-4 overflow-y-auto" style={{ minHeight: '400px', maxHeight: 'calc(100vh - 260px)' }}>
          {mensagens.length === 0 && (
            <div className="h-full flex items-center justify-center text-gray-600 text-sm">
              Nenhuma mensagem ainda. Comece digitando abaixo.
            </div>
          )}
          <div className="space-y-3">
            {mensagens.map(m => (
              <div key={m.key} className={`flex ${m.tipo === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-xl px-4 py-2.5 ${m.tipo === 'user' ? 'bg-[#071DE3] text-white' : 'bg-gray-800 text-gray-100 border border-gray-700'}`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.texto}</p>
                  <div className={`flex items-center gap-2 mt-1 text-[10px] ${m.tipo === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>
                    <span>{fmtHora(m.hora)}</span>
                    {m.pops && <span className="truncate max-w-[200px]" title={m.pops}>· POPs: {m.pops.split(',').length}</span>}
                    {m.tokensIn != null && (m.tokensIn + m.tokensOut) > 0 && (
                      <span>· {(m.tokensIn + m.tokensOut).toLocaleString()} tok</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {aguardandoBot && (
              <div className="flex justify-start">
                <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  <span className="text-sm text-gray-400">Maluco está pensando…</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {imagem && (
          <div className="bg-[#1a1a24] border border-gray-800 rounded-xl p-3 flex items-center gap-3">
            <img src={imagem.preview} alt="preview" className="w-16 h-16 object-cover rounded-lg" />
            <div className="flex-1 text-sm text-gray-400">Imagem pronta pra enviar. Digite uma legenda ou pergunta (opcional).</div>
            <button onClick={() => setImagem(null)} className="text-gray-500 hover:text-red-400"><X className="w-4 h-4" /></button>
          </div>
        )}

        {erro && <div className="text-xs text-red-400 bg-red-900/30 border border-red-900/40 rounded-lg px-3 py-2">{erro}</div>}

        <div className="flex items-end gap-2 bg-[#1a1a24] border border-gray-800 rounded-xl p-2">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          <button
            onClick={() => fileRef.current?.click()}
            className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
            title="Anexar imagem"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
            placeholder={imagem ? 'Legenda ou pergunta sobre a imagem…' : 'Digite uma mensagem (Enter envia, Shift+Enter pula linha)'}
            rows={1}
            className="flex-1 bg-transparent text-white text-sm resize-none outline-none px-2 py-2 max-h-32"
            style={{ minHeight: '40px' }}
          />
          <button
            onClick={enviar}
            disabled={sending || (!texto.trim() && !imagem)}
            className="p-2.5 bg-[#071DE3] hover:bg-[#0516B0] disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </main>
    </div>
  )
}
