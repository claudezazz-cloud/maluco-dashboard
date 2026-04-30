import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

// Busca clientes por nome ou código. Token-protected (não exige sessão de usuário)
// para o N8N consumir. Mantém o mesmo padrão de outros endpoints internos.
const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const tok = req.headers.get('x-token')
  if (tok !== TOKEN) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const q = (searchParams.get('q') || '').trim()
  const limit = Math.min(parseInt(searchParams.get('limit') || '8', 10), 30)
  if (!q) return NextResponse.json({ resultados: [] })

  try {
    // ILIKE sobre nome e cod, ranking por relevância (match exato no início > contém)
    const norm = q.replace(/[%_]/g, '')
    const r = await query(
      `SELECT cod, nome,
        CASE
          WHEN LOWER(nome) = LOWER($1) THEN 100
          WHEN cod = $1 THEN 99
          WHEN LOWER(nome) LIKE LOWER($1) || '%' THEN 90
          WHEN LOWER(nome) LIKE '%' || LOWER($1) || '%' THEN 50
          WHEN cod LIKE $1 || '%' THEN 40
          ELSE 1
        END AS score
       FROM dashboard_clientes
       WHERE ativo = true
         AND (LOWER(nome) LIKE '%' || LOWER($1) || '%' OR cod LIKE '%' || $1 || '%')
       ORDER BY score DESC, nome
       LIMIT $2`,
      [norm, limit]
    )
    return NextResponse.json({
      resultados: r.rows.map(row => ({ cod: row.cod, nome: row.nome })),
      total: r.rowCount,
    })
  } catch (e) {
    console.error('GET /api/clientes/buscar:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
