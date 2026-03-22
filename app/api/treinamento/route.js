import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const result = await query('SELECT id, regra FROM regras ORDER BY id ASC')
  return NextResponse.json(result.rows)
}

export async function POST(req) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { regra } = await req.json()
  if (!regra?.trim()) return NextResponse.json({ error: 'Regra não pode ser vazia' }, { status: 400 })

  const result = await query(
    'INSERT INTO regras (regra) VALUES ($1) RETURNING *',
    [regra.trim()]
  )
  return NextResponse.json(result.rows[0], { status: 201 })
}
