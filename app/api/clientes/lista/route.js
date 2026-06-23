import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/clientes/lista?q=&page=0&comHistorico=0
// Lista paginada de TODOS os clientes ativos + os fatos (histórico) de cada um.
// Usada pela página /clientes do dashboard. Auth de sessão (admin ou colaborador).
const PAGE_SIZE = 40

export async function GET(req) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10))
  const comHistorico = searchParams.get('comHistorico') === '1'

  try {
    const params = []
    let where = 'c.ativo = true'
    if (q) {
      params.push(q)
      where += ` AND (c.cod = $1 OR c.cod LIKE $1 || '%' OR unaccent(LOWER(c.nome)) LIKE '%' || unaccent(LOWER($1)) || '%')`
    }
    const havingHist = comHistorico ? 'HAVING COUNT(m.id) > 0' : ''

    // total (clientes distintos que casam o filtro)
    const totalRes = await query(
      `SELECT COUNT(*)::int AS total FROM (
         SELECT c.cod
         FROM dashboard_clientes c
         LEFT JOIN bot_memoria_longa m
           ON m.entidade_tipo='cliente' AND m.ativo=true AND split_part(m.entidade_id,' - ',1)=c.cod
         WHERE ${where}
         GROUP BY c.cod ${havingHist}
       ) t`,
      params
    )
    const total = totalRes.rows[0]?.total || 0

    const dataParams = [...params, PAGE_SIZE, page * PAGE_SIZE]
    const r = await query(
      `SELECT c.cod, c.nome,
              COUNT(m.id)::int AS n_fatos,
              COALESCE(
                json_agg(
                  json_build_object('fato', m.fato, 'categoria', m.categoria, 'ocorrencias', m.ocorrencias,
                                    'ultima', to_char(m.ultima_ocorrencia,'DD/MM/YYYY'))
                  ORDER BY m.peso DESC, m.ocorrencias DESC
                ) FILTER (WHERE m.id IS NOT NULL),
                '[]'
              ) AS fatos
       FROM dashboard_clientes c
       LEFT JOIN bot_memoria_longa m
         ON m.entidade_tipo='cliente' AND m.ativo=true AND split_part(m.entidade_id,' - ',1)=c.cod
       WHERE ${where}
       GROUP BY c.cod, c.nome
       ${havingHist}
       ORDER BY ${comHistorico ? 'COUNT(m.id) DESC,' : ''} c.nome
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    )

    return NextResponse.json({
      clientes: r.rows,
      total,
      page,
      pageSize: PAGE_SIZE,
      hasMore: (page + 1) * PAGE_SIZE < total,
    })
  } catch (e) {
    console.error('GET /api/clientes/lista:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
