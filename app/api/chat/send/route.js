import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { randomUUID } from 'crypto'

const N8N_URL = process.env.N8N_URL || 'https://n8n.srv1537041.hstgr.cloud'
const WEBHOOK_PATH = '/webhook/whatsapp'

function chatIdFor(session) {
  const email = (session.email || 'user').replace(/[^a-z0-9]/gi, '').toLowerCase()
  return `dashboard-${email}@c.us`
}

export async function POST(req) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    const { tipo, texto, imageBase64, imageMimetype, caption } = await req.json()
    if (!['text', 'image'].includes(tipo)) {
      return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
    }

    const chatId = chatIdFor(session)
    const messageId = randomUUID().replace(/-/g, '').toUpperCase()
    const pushName = session.nome || session.email || 'Dashboard'
    const timestamp = Math.floor(Date.now() / 1000)

    const baseKey = { id: messageId, remoteJid: chatId, fromMe: false, participant: chatId }
    const baseData = { key: baseKey, pushName, messageTimestamp: timestamp }

    let message
    if (tipo === 'text') {
      if (!texto || !texto.trim()) return NextResponse.json({ error: 'texto vazio' }, { status: 400 })
      message = { conversation: texto }
    } else {
      if (!imageBase64) return NextResponse.json({ error: 'imagem ausente' }, { status: 400 })
      message = {
        imageMessage: {
          caption: caption || '',
          mimetype: imageMimetype || 'image/jpeg',
          // Campos extras consumidos pelo workflow para pular Baixa Imagem
          dashboardBase64: imageBase64,
          dashboardMimetype: imageMimetype || 'image/jpeg'
        }
      }
    }

    const payload = { body: { data: { ...baseData, message } } }

    const url = N8N_URL.replace(/\/$/, '') + WEBHOOK_PATH
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
