import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026'

// GET /api/pops/buscar?titulo=Nome%20do%20POP
// Chamado pelo agent loop como tool buscar_pop.
// Retorna conteúdo completo de um POP pelo título (exact → ILIKE → ts_rank).
export async function GET(req) {
  const tok = req.headers.get('x-token')
  if (tok !== TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const titulo = (searchParams.get('titulo') || '').trim()
  if (!titulo) return NextResponse.json({ error: 'titulo obrigatório' }, { status: 400 })

  // 1. Exact match
  const exact = await query(
    `SELECT titulo, categoria, conteudo FROM dashboard_pops
     WHERE ativo = true AND LOWER(titulo) = LOWER($1) LIMIT 1`,
    [titulo]
  )
  if (exact.rows.length > 0) {
    return NextResponse.json({ found: true, pop: exact.rows[0] })
  }

  // 2. ILIKE — título contém a busca OU busca contém o título
  const ilike = await query(
    `SELECT titulo, categoria, conteudo FROM dashboard_pops
     WHERE ativo = true
       AND (LOWER(titulo) ILIKE '%' || LOWER($1) || '%'
            OR LOWER($1) ILIKE '%' || LOWER(titulo) || '%')
     LIMIT 1`,
    [titulo]
  )
  if (ilike.rows.length > 0) {
    return NextResponse.json({ found: true, pop: ilike.rows[0] })
  }

  // 3. ts_rank fallback com stemming português
  try {
    const ts = await query(
      `SELECT titulo, categoria, conteudo FROM dashboard_pops
       WHERE ativo = true
         AND to_tsvector('portuguese', titulo || ' ' || COALESCE(conteudo,'')) @@ plainto_tsquery('portuguese', $1)
       ORDER BY ts_rank(
         to_tsvector('portuguese', titulo || ' ' || COALESCE(conteudo,'')),
         plainto_tsquery('portuguese', $1)
       ) DESC LIMIT 1`,
      [titulo]
    )
    if (ts.rows.length > 0) {
      return NextResponse.json({ found: true, pop: ts.rows[0] })
    }
  } catch (_) {}

  return NextResponse.json({ found: false, pop: null })
}
