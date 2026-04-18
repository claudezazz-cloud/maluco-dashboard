'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { Send, ImagePlus, Trash2, Loader2, X, Sparkles, Mic, Square } from 'lucide-react'

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
  const [imagens, setImagens] = useState([])
  const [sending, setSending] = useState(false)
  const [aguardandoBot, setAguardandoBot] = useState(false)
  const [erro, setErro] = useState('')
  const [skills, setSkills] = useState([])
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [audio, setAudio] = useState(null) // { base64, mimetype, url, duration }
  const [gravando, setGravando] = useState(false)
  const [gravSecs, setGravSecs] = useState(0)
  const scrollRef = useRef(null)
  const fileRef = useRef(null)
  const textareaRef = useRef(null)
  const skillsRef = useRef(null)
  const atBottomRef = useRef(true)
  const mediaRecRef = useRef(null)
  const audioChunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const MAX_IMG = 10
  const MAX_AUDIO_SECS = 120

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) { router.push('/login'); return }
      setUser(d)
    })
  }, [router])

  useEffect(() => {
    if (!user) return
    fetch('/api/skills/ativas').then(r => r.ok ? r.json() : []).then(d => setSkills(d || [])).catch(() => {})
  }, [user])

  // Fecha dropdown de skills ao clicar fora
  useEffect(() => {
    function handleClick(e) {
      if (skillsRef.current && !skillsRef.current.contains(e.target)) setSkillsOpen(false)
    }
    if (skillsOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [skillsOpen])

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

  // Auto-scroll: só se o usuário JÁ estava perto do fim
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [mensagens, aguardandoBot])

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    // Considera "no fim" se está a menos de 60px do bottom
    atBottomRef.current = (el.scrollHeight - el.scrollTop - el.clientHeight) < 60
  }

  async function onFile(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const espacoRestante = MAX_IMG - imagens.length
    if (espacoRestante <= 0) { setErro(`Máximo ${MAX_IMG} imagens`); e.target.value = ''; return }
    const selecionados = files.slice(0, espacoRestante)
    if (files.length > espacoRestante) setErro(`Só cabem mais ${espacoRestante} imagens (máx ${MAX_IMG})`)

    const novos = []
    for (const f of selecionados) {
      if (f.size > 5 * 1024 * 1024) { setErro(`${f.name}: maior que 5MB`); continue }
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(f)
      })
      novos.push({ base64: dataUrl.split(',')[1], mimetype: f.type || 'image/jpeg', preview: dataUrl, name: f.name })
    }
    setImagens(prev => [...prev, ...novos])
    e.target.value = ''
  }

  function removerImagem(idx) {
    setImagens(prev => prev.filter((_, i) => i !== idx))
  }

  async function iniciarGravacao() {
    if (gravando) return
    setErro('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      audioChunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data) }
      rec.onstop = async () => {
        try {
          const tipo = rec.mimeType || mime || 'audio/webm'
          const blob = new Blob(audioChunksRef.current, { type: tipo })
          const dataUrl = await new Promise((res, rej) => {
            const r = new FileReader()
            r.onload = () => res(r.result)
            r.onerror = rej
            r.readAsDataURL(blob)
          })
          const base64 = dataUrl.split(',')[1]
          const url = URL.createObjectURL(blob)
          setAudio({ base64, mimetype: tipo.split(';')[0], url, duration: gravSecs })
        } catch (err) {
          setErro('Falha ao processar áudio: ' + err.message)
        } finally {
          streamRef.current?.getTracks().forEach(t => t.stop())
          streamRef.current = null
        }
      }
      mediaRecRef.current = rec
      setGravSecs(0)
      rec.start()
      setGravando(true)
      timerRef.current = setInterval(() => {
        setGravSecs(s => {
          if (s + 1 >= MAX_AUDIO_SECS) { pararGravacao(); return s + 1 }
          return s + 1
        })
      }, 1000)
    } catch (e) {
      setErro('Microfone negado: ' + e.message)
    }
  }

  function pararGravacao() {
    if (!gravando) return
    try { mediaRecRef.current?.stop() } catch {}
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setGravando(false)
  }

  function descartarAudio() {
    if (gravando) pararGravacao()
    if (audio?.url) URL.revokeObjectURL(audio.url)
    setAudio(null)
    setGravSecs(0)
  }

  function fmtSecs(s) {
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${r.toString().padStart(2, '0')}`
  }

  function inserirSkill(skill) {
    const slug = skill.nome.startsWith('/') ? skill.nome : '/' + skill.nome
    setTexto(prev => {
      const pref = prev.trim()
      return pref ? `${slug} ${pref}` : `${slug} `
    })
    setSkillsOpen(false)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  async function enviar() {
    if (sending) return
    if (gravando) pararGravacao()
    if (!texto.trim() && imagens.length === 0 && !audio) return
    setSending(true)
    setErro('')
    atBottomRef.current = true
    try {
      let body
      if (audio) {
        body = { tipo: 'audio', audioBase64: audio.base64, audioMimetype: audio.mimetype }
      } else if (imagens.length > 0) {
        body = {
          tipo: 'image',
          images: imagens.map(i => ({ base64: i.base64, mimetype: i.mimetype })),
          caption: texto || ''
        }
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
      setImagens([])
      if (audio?.url) URL.revokeObjectURL(audio.url)
      setAudio(null)
      setGravSecs(0)
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
        <div ref={scrollRef} onScroll={onScroll} className="flex-1 bg-surface-raised/60 border border-white/[0.04] rounded-2xl p-4 overflow-y-auto" style={{ minHeight: '400px', maxHeight: 'calc(100vh - 260px)' }}>
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

        {/* Image previews */}
        {imagens.length > 0 && (
          <div className="bg-surface-raised/60 border border-white/[0.04] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">
                {imagens.length}/{MAX_IMG} imagens
              </span>
              <button onClick={() => setImagens([])} className="text-[11px] text-gray-600 hover:text-red-400 transition-colors">
                Remover todas
              </button>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {imagens.map((img, idx) => (
                <div key={idx} className="relative group aspect-square">
                  <img src={img.preview} alt={img.name} className="w-full h-full object-cover rounded-lg border border-white/[0.08]" />
                  <button
                    onClick={() => removerImagem(idx)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audio preview */}
        {audio && !gravando && (
          <div className="bg-surface-raised/60 border border-white/[0.04] rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-300 font-medium">Áudio pronto</div>
              <div className="text-[11px] text-gray-600 font-mono">{fmtSecs(audio.duration)} · {audio.mimetype}</div>
              <audio src={audio.url} controls className="mt-1.5 w-full h-7" style={{ maxWidth: '100%' }} />
            </div>
            <button
              onClick={descartarAudio}
              className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-500/[0.06] rounded-lg transition-colors shrink-0"
              title="Descartar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Recording indicator */}
        {gravando && (
          <div className="bg-red-500/[0.06] border border-red-500/25 rounded-xl p-3 flex items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <div className="flex-1 text-xs text-red-300">
              Gravando... <span className="font-mono text-red-400">{fmtSecs(gravSecs)}</span>
              <span className="text-gray-600 ml-2">(máx {fmtSecs(MAX_AUDIO_SECS)})</span>
            </div>
            <button
              onClick={pararGravacao}
              className="flex items-center gap-1.5 text-xs text-red-300 hover:text-white bg-red-500/15 hover:bg-red-500/30 border border-red-500/30 px-3 py-1.5 rounded-lg transition-all"
            >
              <Square className="w-3 h-3" /> Parar
            </button>
          </div>
        )}

        {erro && <div className="text-xs text-red-400 bg-red-500/[0.08] border border-red-500/20 rounded-lg px-3 py-2">{erro}</div>}

        {/* Input area */}
        <div className="flex items-end gap-2 bg-surface-raised/80 border border-white/[0.06] rounded-2xl p-2 relative">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFile} />

          {/* Skills button */}
          <div className="relative" ref={skillsRef}>
            <button
              onClick={() => setSkillsOpen(v => !v)}
              className={`p-2.5 rounded-lg transition-all duration-200 ${
                skillsOpen
                  ? 'text-brand bg-brand/[0.1]'
                  : 'text-gray-600 hover:text-brand hover:bg-brand/[0.06]'
              }`}
              title={skills.length ? `${skills.length} skills ativas` : 'Nenhuma skill ativa'}
            >
              <Sparkles className="w-5 h-5" />
            </button>
            {skillsOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-72 max-h-80 overflow-y-auto bg-surface-raised border border-white/[0.08] rounded-xl shadow-2xl shadow-black/60 z-50 animate-fade-in">
                <div className="px-3 py-2 border-b border-white/[0.04] text-[11px] text-gray-500 uppercase tracking-wider font-semibold">
                  Skills ativas ({skills.length})
                </div>
                {skills.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-gray-600 text-center">
                    Nenhuma skill ativa.<br />
                    <span className="text-gray-700">Crie em Treinamento &gt; Skills.</span>
                  </div>
                ) : (
                  <div className="py-1">
                    {skills.map(s => (
                      <button
                        key={s.nome}
                        onClick={() => inserirSkill(s)}
                        className="w-full text-left px-3 py-2 hover:bg-white/[0.04] transition-colors group"
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-mono text-xs text-brand font-semibold shrink-0">{s.nome}</span>
                        </div>
                        {s.descricao && (
                          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{s.descricao}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={imagens.length >= MAX_IMG || !!audio || gravando}
            className="p-2.5 text-gray-600 hover:text-brand hover:bg-brand/[0.06] disabled:opacity-30 disabled:hover:text-gray-600 disabled:hover:bg-transparent rounded-lg transition-all duration-200"
            title={imagens.length >= MAX_IMG ? `Máximo ${MAX_IMG} imagens` : 'Anexar imagens (até 10)'}
          >
            <ImagePlus className="w-5 h-5" />
          </button>

          <button
            onClick={gravando ? pararGravacao : iniciarGravacao}
            disabled={!!audio || imagens.length > 0}
            className={`p-2.5 rounded-lg transition-all duration-200 disabled:opacity-30 disabled:hover:bg-transparent ${
              gravando
                ? 'text-red-400 bg-red-500/[0.12] hover:bg-red-500/[0.2]'
                : 'text-gray-600 hover:text-brand hover:bg-brand/[0.06]'
            }`}
            title={gravando ? 'Parar gravação' : 'Gravar áudio'}
          >
            {gravando ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
            placeholder={
              audio ? 'Áudio pronto — clique em enviar' :
              gravando ? 'Gravando áudio...' :
              imagens.length ? `Legenda/pergunta para ${imagens.length} imagem(ns)...` :
              'Digite uma mensagem ou / para skills...'
            }
            disabled={!!audio || gravando}
            rows={1}
            className="flex-1 bg-transparent text-white text-sm resize-none outline-none px-2 py-2 max-h-32 placeholder:text-gray-700 disabled:opacity-50"
            style={{ minHeight: '40px' }}
          />
          <button
            onClick={enviar}
            disabled={sending || gravando || (!texto.trim() && imagens.length === 0 && !audio)}
            className="p-2.5 bg-brand hover:bg-brand-dark disabled:bg-white/[0.04] disabled:text-gray-700 text-white rounded-lg transition-all duration-200"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </main>
    </div>
  )
}
