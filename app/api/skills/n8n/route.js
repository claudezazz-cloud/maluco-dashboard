import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req) {
  const token = req.headers.get('x-token')
  if (token !== (process.env.N8N_POPS_TOKEN || 'MALUCO_POPS_2026')) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  try {
    const result = await query(
      'SELECT nome, prompt_base FROM dashboard_skills WHERE ativo = true ORDER BY nome ASC'
    ).catch(() => ({ rows: [] }))
    return NextResponse.json({ skills: result.rows })
  } catch (e) {
    console.error('GET /skills/n8n:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
