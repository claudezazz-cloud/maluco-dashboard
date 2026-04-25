import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'
import { ensureTables } from '@/lib/evolutivo/indexer'

async function auth() {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return null
  return session
}

export async function GET() {
  if (!await auth()) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await ensureTables()
  const res = await query('SELECT * FROM evolutive_sources ORDER BY id LIMIT 1')
  return NextResponse.json(res.rows[0] || null)
}

export async function PUT(req) {
  if (!await auth()) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await ensureTables()

  const { nome, pasta, ignorar } = await req.json()
  if (!pasta) return NextResponse.json({ error: 'Campo pasta é obrigatório' }, { status: 400 })

  const existing = await query('SELECT id FROM evolutive_sources LIMIT 1')

  let result
  if (existing.rows[0]) {
    result = await query(
      `UPDATE evolutive_sources SET nome = $1, pasta = $2, ignorar = $3 WHERE id = $4 RETURNING *`,
      [nome || 'Cerebro Evolutivo', pasta, ignorar || '.obsidian,templates,lixeira,trash', existing.rows[0].id]
    )
  } else {
    result = await query(
      `INSERT INTO evolutive_sources (nome, pasta, ignorar) VALUES ($1, $2, $3) RETURNING *`,
      [nome || 'Cerebro Evolutivo', pasta, ignorar || '.obsidian,templates,lixeira,trash']
    )
  }

  return NextResponse.json(result.rows[0])
}
