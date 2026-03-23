import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

// Endpoint público para o N8N buscar os POPs
// Protegido por token simples no header x-token
export async function GET(req) {
  const token = req.headers.get('x-token')
  if (token !== process.env.N8N_POPS_TOKEN) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const result = await query(
      `SELECT titulo, categoria, conteudo FROM dashboard_pops WHERE ativo = true ORDER BY categoria, titulo`
    )
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
