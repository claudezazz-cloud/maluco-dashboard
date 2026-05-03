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
    const norm = q.replace(/[%_]/g, '').trim()
    const words = norm.split(/\s+/).filter(Boolean)

    // Guard: query só com chars especiais vira lista vazia de words → SQL inválido
    if (words.length === 0) return NextResponse.json({ resultados: [], total: 0 })

    // Build per-word AND conditions using unaccent para achar "Sérgio" com "sergio"
    const wordConditions = words.map((_, i) => `unaccent(LOWER(nome)) LIKE '%' || unaccent(LOWER($${i + 1})) || '%'`).join(' AND ')
    const params = [...words, limit]
    const limitIdx = params.length

    const scoreExpr = `
      CASE
        WHEN unaccent(LOWER(nome)) = unaccent(LOWER($1)) THEN 100
        WHEN cod = $1 THEN 99
        WHEN unaccent(LOWER(nome)) LIKE unaccent(LOWER($1)) || '%' THEN 90
        WHEN ${wordConditions} THEN 50
        WHEN cod LIKE $1 || '%' THEN 40
        ELSE 1
      END`

    const codCondition = `cod LIKE '%' || $1 || '%'`
    const whereClause = words.length > 1
      ? `(${wordConditions} OR ${codCondition})`
      : `(unaccent(LOWER(nome)) LIKE '%' || unaccent(LOWER($1)) || '%' OR ${codCondition})`

    const r = await query(
      `SELECT cod, nome, ${scoreExpr} AS score
       FROM dashboard_clientes
       WHERE ativo = true AND ${whereClause}
       ORDER BY score DESC, nome
       LIMIT $${limitIdx}`,
      params
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
