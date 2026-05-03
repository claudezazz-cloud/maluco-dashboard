import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const EVOLUTION_URL = 'https://lanlunar-evolution.cloudfy.live/message/sendText/ZazzClaude'
const EVOLUTION_KEY = 'KGWUTIl4uXDVxFiJMhFgT1LzP8bHRcze'
const AUTH_TOKEN = process.env.INTERNAL_TOKEN || 'MALUCO_POPS_2026'

export async function POST(req) {
  const token = req.headers.get('x-token')
  if (token !== AUTH_TOKEN) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const pendentes = await query(`
    SELECT ma.id, ma.mensagem, g.chat_id, g.nome AS grupo
    FROM mensagens_agendadas ma
    JOIN grupos_whatsapp g ON g.id = ma.grupo_id
    WHERE ma.status = 'pendente' AND ma.agendar_para <= NOW()
    ORDER BY ma.agendar_para ASC
    LIMIT 50
  `)

  if (pendentes.rows.length === 0) return NextResponse.json({ ok: true, enviados: 0 })

  const results = []
  for (const row of pendentes.rows) {
    try {
      const res = await fetch(EVOLUTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
        body: JSON.stringify({ number: row.chat_id, text: row.mensagem }),
      })
      if (res.ok) {
        await query(
          `UPDATE mensagens_agendadas SET status='enviado', enviado_em=NOW() WHERE id=$1`,
          [row.id]
        )
        results.push({ id: row.id, status: 'enviado', grupo: row.grupo })
      } else {
        const err = await res.text()
        await query(
          `UPDATE mensagens_agendadas SET status='erro', erro=$1 WHERE id=$2`,
          [err.slice(0, 500), row.id]
        )
        results.push({ id: row.id, status: 'erro', erro: err.slice(0, 100) })
      }
    } catch (e) {
      await query(
        `UPDATE mensagens_agendadas SET status='erro', erro=$1 WHERE id=$2`,
        [e.message.slice(0, 500), row.id]
      )
      results.push({ id: row.id, status: 'erro', erro: e.message })
    }
  }

  return NextResponse.json({ ok: true, enviados: results.filter(r => r.status === 'enviado').length, results })
}
