import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026'
const N8N_WEBHOOK = 'https://n8n.srv1537041.hstgr.cloud/webhook/whatsapp'
const BOT_NUMBER = '554396543242@s.whatsapp.net'

// POST /api/solicitacoes/processar
// Chamado via cron VPS a cada minuto.
// Busca agendamentos devidos agora (hora + dia) e dispara no N8N.
export async function POST(req) {
  const tok = req.headers.get('x-token')
  if (tok !== TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Hora e dia em BRT (América/São Paulo)
  const brtFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  })
  const parts = Object.fromEntries(brtFmt.formatToParts(new Date()).map(p => [p.type, p.value]))
  const horaAtual = `${parts.hour}:${parts.minute}`
  const diasMap = { 'dom': 'dom', 'seg': 'seg', 'ter': 'ter', 'qua': 'qua', 'qui': 'qui', 'sex': 'sex', 'sab': 'sab', 'sáb': 'sab' }
  const weekdayClean = (parts.weekday || '').replace(/\./g, '').toLowerCase()
  const diaAtual = diasMap[weekdayClean] || weekdayClean

  const result = await query(
    `UPDATE dashboard_solicitacoes_programadas
     SET ultimo_executado = NOW()
     WHERE id IN (
       SELECT id FROM dashboard_solicitacoes_programadas
       WHERE ativo = true
         AND hora = $1
         AND (dias_semana = 'todos' OR $2 = ANY(string_to_array(dias_semana, ',')))
         AND (ultimo_executado IS NULL OR ultimo_executado < NOW() - INTERVAL '50 minutes')
       ORDER BY id ASC
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [horaAtual, diaAtual]
  )

  if (result.rows.length === 0) {
    return NextResponse.json({ ok: true, executadas: 0, hora: horaAtual, dia: diaAtual })
  }

  const executadas = []
  const erros = []

  for (const task of result.rows) {
    const chatIds = (task.chat_id || '').split(',').map(s => s.trim()).filter(Boolean)

    for (const chatId of chatIds) {
      const body = {
        event: 'messages.upsert',
        data: {
          key: {
            id: `cron-${task.id}-${Date.now()}`,
            remoteJid: chatId,
            fromMe: false,
          },
          message: {
            extendedTextMessage: {
              text: task.comando,
              contextInfo: { mentionedJid: [BOT_NUMBER] },
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
        if (!r.ok) erros.push(`${task.nome}@${chatId}: HTTP ${r.status}`)
      } catch (e) {
        erros.push(`${task.nome}@${chatId}: ${e.message}`)
      }
    }

    executadas.push(task.nome)
  }

  return NextResponse.json({ ok: true, hora: horaAtual, dia: diaAtual, executadas, erros: erros.length ? erros : undefined })
}
