import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const EVOLUTION_URL = 'https://lanlunar-evolution.cloudfy.live/message/sendText/ZazzClaude'
const EVOLUTION_KEY = 'KGWUTIl4uXDVxFiJMhFgT1LzP8bHRcze'
const AUTH_TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026'
const MAX_TENTATIVAS = 3

export async function POST(req) {
  const token = req.headers.get('x-token')
  if (token !== AUTH_TOKEN) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  // Adiciona coluna tentativas se ainda não existe (migração segura)
  await query(`ALTER TABLE mensagens_agendadas ADD COLUMN IF NOT EXISTS tentativas INT DEFAULT 0`)

  // Atomic claim: marca 'processando' atomicamente via FOR UPDATE SKIP LOCKED
  // Evita que dois crons concorrentes processem a mesma mensagem
  const claimed = await query(`
    UPDATE mensagens_agendadas SET status='processando'
    WHERE id IN (
      SELECT id FROM mensagens_agendadas
      WHERE status='pendente' AND agendar_para <= NOW()
      ORDER BY agendar_para ASC
      LIMIT 50
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `)

  if (claimed.rows.length === 0) return NextResponse.json({ ok: true, enviados: 0 })

  const ids = claimed.rows.map(r => r.id)

  // Busca dados completos das msgs claims
  const pendentes = await query(`
    SELECT ma.id, ma.mensagem, ma.tentativas, g.chat_id, g.nome AS grupo
    FROM mensagens_agendadas ma
    JOIN grupos_whatsapp g ON g.id = ma.grupo_id
    WHERE ma.id = ANY($1)
    ORDER BY ma.agendar_para ASC
  `, [ids])

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
        const tentativas = (row.tentativas || 0) + 1
        if (tentativas >= MAX_TENTATIVAS) {
          await query(
            `UPDATE mensagens_agendadas SET status='erro', erro=$1, tentativas=$2 WHERE id=$3`,
            [err.slice(0, 500), tentativas, row.id]
          )
        } else {
          // Retry com backoff de 5min
          await query(
            `UPDATE mensagens_agendadas SET status='pendente', erro=$1, tentativas=$2,
             agendar_para=NOW() + interval '5 minutes' WHERE id=$3`,
            [err.slice(0, 500), tentativas, row.id]
          )
        }
        results.push({ id: row.id, status: tentativas >= MAX_TENTATIVAS ? 'erro' : 'retry', erro: err.slice(0, 100) })
      }
    } catch (e) {
      const tentativas = (row.tentativas || 0) + 1
      if (tentativas >= MAX_TENTATIVAS) {
        await query(
          `UPDATE mensagens_agendadas SET status='erro', erro=$1, tentativas=$2 WHERE id=$3`,
          [e.message.slice(0, 500), tentativas, row.id]
        )
      } else {
        await query(
          `UPDATE mensagens_agendadas SET status='pendente', erro=$1, tentativas=$2,
           agendar_para=NOW() + interval '5 minutes' WHERE id=$3`,
          [e.message.slice(0, 500), tentativas, row.id]
        )
      }
      results.push({ id: row.id, status: tentativas >= MAX_TENTATIVAS ? 'erro' : 'retry', erro: e.message })
    }
  }

  return NextResponse.json({ ok: true, enviados: results.filter(r => r.status === 'enviado').length, results })
}
