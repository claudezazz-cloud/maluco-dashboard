import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    const result = await query(
      'SELECT nome, descricao FROM dashboard_skills WHERE ativo = true ORDER BY nome ASC'
    ).catch(() => ({ rows: [] }))
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
