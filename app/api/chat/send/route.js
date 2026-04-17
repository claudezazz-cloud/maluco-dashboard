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

function buildPayload({ chatId, pushName, message }) {
  const messageId = randomUUID().replace(/-/g, '').toUpperCase()
  const timestamp = Math.floor(Date.now() / 1000)
  const key = { id: messageId, remoteJid: chatId, fromMe: false, participant: chatId }
  return {
    messageId,
    payload: { event: 'messages.upsert', data: { key, pushName, messageTimestamp: timestamp, message } }
  }
}

async function postWebhook(url, payload) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`webhook ${resp.status}: ${text.substring(0, 300)}`)
  }
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
    const url = N8N_URL.replace(/\/$/, '') + WEBHOOK_PATH

    if (tipo === 'text') {
      if (!texto || !texto.trim()) return NextResponse.json({ error: 'texto vazio' }, { status: 400 })
      const { messageId, payload } = buildPayload({ chatId, pushName, message: { conversation: texto } })
      await postWebhook(url, payload)
      return NextResponse.json({ ok: true, chatId, messageIds: [messageId] })
    }

    // Imagem — aceita um único imageBase64 (retrocompat) ou array images[]
    const lista = Array.isArray(images) && images.length
      ? images
      : (imageBase64 ? [{ base64: imageBase64, mimetype: imageMimetype }] : [])

    if (!lista.length) return NextResponse.json({ error: 'imagem ausente' }, { status: 400 })
    if (lista.length > MAX_IMAGES) return NextResponse.json({ error: `máximo ${MAX_IMAGES} imagens` }, { status: 400 })

    const sharedCaption = caption || ''
    const messageIds = []

    for (let i = 0; i < lista.length; i++) {
      const img = lista[i]
      // Só a última imagem carrega a legenda/pergunta — assim o bot responde 1 vez com todas no histórico
      const imgCaption = i === lista.length - 1 ? sharedCaption : ''
      const mime = img.mimetype || 'image/jpeg'
      const message = {
        imageMessage: {
          caption: imgCaption,
          mimetype: mime,
          dashboardBase64: img.base64,
          dashboardMimetype: mime
        }
      }
      const { messageId, payload } = buildPayload({ chatId, pushName, message })
      await postWebhook(url, payload)
      messageIds.push(messageId)
      // Pequeno delay para garantir ordem no N8N
      if (i < lista.length - 1) await new Promise(r => setTimeout(r, 150))
    }

    return NextResponse.json({ ok: true, chatId, messageIds })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
