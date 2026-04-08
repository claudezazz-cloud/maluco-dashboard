import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

// Endpoint para o N8N buscar POPs e colaboradores
// Sem autenticação complexa para facilitar uso no N8N
export async function GET(req) {
  const token = req.headers.get('x-token')
  if (token !== (process.env.N8N_POPS_TOKEN || 'MALUCO_POPS_2026')) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const [popsResult, colabResult] = await Promise.all([
      query(`SELECT titulo, categoria, conteudo, COALESCE(prioridade, 'relevante') as prioridade FROM dashboard_pops WHERE ativo = true ORDER BY categoria, titulo`).catch(() => ({ rows: [] })),
      query(`SELECT nome, cargo, funcoes FROM dashboard_colaboradores WHERE ativo = true ORDER BY nome`).catch(() => ({ rows: [] }))
    ])

    return NextResponse.json({
      pops: popsResult.rows,
      colaboradores: colabResult.rows
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
