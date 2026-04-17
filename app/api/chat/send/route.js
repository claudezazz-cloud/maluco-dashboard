import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { randomUUID } from 'crypto'

const N8N_URL = process.env.N8N_URL || 'https://n8n.srv1537041.hstgr.cloud'
const WEBHOOK_PATH = '/webhook/whatsapp'
const MAX_IMAGES = 10

function chatIdFor(session) {
  const email = (session.email || 'user').replace(/[^a-z0-9]/gi, '').toLowerCase()
  return `dashboard-${email}@c.us`
}

export async function POST(req) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    const body = await req.json()
    const { tipo, texto, imageBase64, imageMimetype, caption, images } = body

    if (!['text', 'image'].includes(tipo)) {
      return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
    }

    const chatId = chatIdFor(session)
    const pushName = session.nome || session.email || 'Dashboard'
    const messageId = randomUUID().replace(/-/g, '').toUpperCase()
    const timestamp = Math.floor(Date.now() / 1000)
    const key = { id: messageId, remoteJid: chatId, fromMe: false, participant: chatId }
    const url = N8N_URL.replace(/\/$/, '') + WEBHOOK_PATH

    let message
    if (tipo === 'text') {
      if (!texto || !texto.trim()) return NextResponse.json({ error: 'texto vazio' }, { status: 400 })
      message = { conversation: texto }
    } else {
      const lista = Array.isArray(images) && images.length
        ? images
        : (imageBase64 ? [{ base64: imageBase64, mimetype: imageMimetype }] : [])

      if (!lista.length) return NextResponse.json({ error: 'imagem ausente' }, { status: 400 })
      if (lista.length > MAX_IMAGES) return NextResponse.json({ error: `máximo ${MAX_IMAGES} imagens` }, { status: 400 })

      const first = lista[0]
      const firstMime = first.mimetype || 'image/jpeg'
      message = {
        imageMessage: {
          caption: caption || '',
          mimetype: firstMime,
          dashboardBase64: first.base64,
          dashboardMimetype: firstMime,
          // Imagens adicionais (se houver) — workflow processa todas juntas
          additionalImages: lista.slice(1).map(i => ({
            base64: i.base64,
            mimetype: i.mimetype || 'image/jpeg'
          })),
          totalImages: lista.length
        }
      }
    }

    const payload = { event: 'messages.upsert', data: { key, pushName, messageTimestamp: timestamp, message } }
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!resp.ok) {
      const text = await resp.text()
      return NextResponse.json({ error: `webhook ${resp.status}: ${text.substring(0, 300)}` }, { status: 502 })
    }

    return NextResponse.json({ ok: true, chatId, messageId })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
