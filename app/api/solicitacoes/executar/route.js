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

  // Monta mensagem sintética (mesmo formato do Prepara Body no N8N)
  const body = {
    event: 'messages.upsert',
    data: {
      key: {
        id: 'manual-' + task.id + '-' + Date.now(),
        remoteJid: task.chat_id,
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

  // Injeta no webhook do N8N
  try {
    const r = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!r.ok) {
      return NextResponse.json({ error: 'Erro ao enviar para N8N: ' + r.status }, { status: 502 })
    }

    // Marca como executado
    await query(
      'UPDATE dashboard_solicitacoes_programadas SET ultimo_executado = NOW() WHERE id = $1',
      [id]
    )

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao conectar com N8N: ' + e.message }, { status: 502 })
  }
}
