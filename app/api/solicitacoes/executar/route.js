import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession, requireAdmin } from '@/lib/auth'

const N8N_WEBHOOK = process.env.N8N_WEBHOOK_URL || 'https://n8n.srv1537041.hstgr.cloud/webhook/whatsapp'
const BOT_NUMBER = '554396543242@s.whatsapp.net'

export async function POST(request) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  // Busca a solicitação
  const result = await query('SELECT * FROM dashboard_solicitacoes_programadas WHERE id = $1', [id])
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 })
  }

  const task = result.rows[0]
  const chatIds = (task.chat_id || '').split(',').map(s => s.trim()).filter(Boolean)
  if (chatIds.length === 0) {
    return NextResponse.json({ error: 'Nenhum grupo configurado nesta solicitação' }, { status: 400 })
  }

  // Envia para cada grupo configurado
  const erros = []
  for (const chatId of chatIds) {
    const body = {
      event: 'messages.upsert',
      data: {
        key: {
          id: 'manual-' + task.id + '-' + Date.now(),
          remoteJid: chatId,
          fromMe: false,
        },
        message: {
          extendedTextMessage: {
            text: task.comando,
            contextInfo: {
              mentionedJid: [BOT_NUMBER],
            },
          },
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'Dashboard',
      },
    }

    try {
      const r = await fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) erros.push(`${chatId}: HTTP ${r.status}`)
    } catch (e) {
      erros.push(`${chatId}: ${e.message}`)
    }
  }

  if (erros.length === chatIds.length) {
    return NextResponse.json({ error: 'Falha em todos os grupos: ' + erros.join(' | ') }, { status: 502 })
  }

  // Marca como executado (mesmo que parcial)
  await query(
    'UPDATE dashboard_solicitacoes_programadas SET ultimo_executado = NOW() WHERE id = $1',
    [id]
  )

  return NextResponse.json({ ok: true, grupos: chatIds.length, erros: erros.length > 0 ? erros : undefined })
}
