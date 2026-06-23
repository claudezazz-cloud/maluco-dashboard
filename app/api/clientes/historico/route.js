import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/clientes/historico?q=<nome ou código>
// Backend da TOOL `historico_cliente` do bot. Token-protected (sem sessão) p/ o N8N consumir.
// Resolve o(s) cliente(s) que casam com q e devolve, pra cada um, os fatos aprendidos
// (bot_memoria_longa) — o "histórico" do cliente. Usado pelo bot ANTES de responder algo
// sobre um cliente específico.
const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026'

export async function GET(req) {
  const tok = req.headers.get('x-token')
  if (tok !== TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  if (!q) return NextResponse.json({ resultados: [] })

  try {
    // 1. Resolve clientes que casam com q (por nome sem acento ou por código)
    const clientesRes = await query(
      `SELECT cod, nome
       FROM dashboard_clientes
       WHERE ativo = true AND (
         cod = $1
         OR cod LIKE $1 || '%'
         OR unaccent(LOWER(nome)) LIKE '%' || unaccent(LOWER($1)) || '%'
       )
       ORDER BY (cod = $1) DESC, (cod LIKE $1 || '%') DESC, nome
       LIMIT 5`,
      [q]
    )
    const clientes = clientesRes.rows
    if (clientes.length === 0) {
      return NextResponse.json({ resultados: [], total: 0, msg: 'Nenhum cliente encontrado.' })
    }

    // 2. Puxa os fatos (histórico) de cada cliente casado, de uma vez
    const cods = clientes.map(c => c.cod)
    const fatosRes = await query(
      `SELECT split_part(entidade_id, ' - ', 1) AS cod, fato, categoria, peso, ocorrencias,
              to_char(ultima_ocorrencia, 'DD/MM/YYYY') AS ultima
       FROM bot_memoria_longa
       WHERE entidade_tipo = 'cliente' AND ativo = true
         AND split_part(entidade_id, ' - ', 1) = ANY($1)
       ORDER BY peso DESC, ocorrencias DESC, ultima_ocorrencia DESC`,
      [cods]
    )
    const fatosPorCod = {}
    for (const f of fatosRes.rows) {
      ;(fatosPorCod[f.cod] = fatosPorCod[f.cod] || []).push({
        fato: f.fato, categoria: f.categoria, ocorrencias: f.ocorrencias, ultima: f.ultima,
      })
    }

    const resultados = clientes.map(c => ({
      cod: c.cod,
      nome: c.nome,
      fatos: fatosPorCod[c.cod] || [],
    }))

    return NextResponse.json({ resultados, total: resultados.length })
  } catch (e) {
    console.error('GET /api/clientes/historico:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
