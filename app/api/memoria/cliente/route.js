import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession, requireAdmin } from '@/lib/auth'

// GET /api/memoria/cliente?q=joao
// Busca fatos de clientes com ILIKE no entidade_id, agrupados por cliente.
// Retorna: [{ entidade_id, fatos: [...], total, ultima_ocorrencia }]
export async function GET(request) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()

  if (!q) return NextResponse.json([])

  try {
    const result = await query(
      `SELECT id, entidade_id, fato, categoria, peso, ocorrencias,
              primeira_ocorrencia, ultima_ocorrencia, ativo, validado_por
       FROM bot_memoria_longa
       WHERE entidade_tipo = 'cliente'
         AND entidade_id ILIKE '%' || $1 || '%'
       ORDER BY entidade_id, peso DESC, ocorrencias DESC`,
      [q]
    )

    // Agrupa por entidade_id
    const grouped = {}
    for (const row of result.rows) {
      if (!grouped[row.entidade_id]) {
        grouped[row.entidade_id] = {
          entidade_id: row.entidade_id,
          fatos: [],
          total_ativos: 0,
          ultima_ocorrencia: null,
        }
      }
      grouped[row.entidade_id].fatos.push(row)
      if (row.ativo) grouped[row.entidade_id].total_ativos++
      const ts = row.ultima_ocorrencia
      if (!grouped[row.entidade_id].ultima_ocorrencia || ts > grouped[row.entidade_id].ultima_ocorrencia) {
        grouped[row.entidade_id].ultima_ocorrencia = ts
      }
    }

    return NextResponse.json(Object.values(grouped).sort((a, b) =>
      b.total_ativos - a.total_ativos || a.entidade_id.localeCompare(b.entidade_id)
    ))
  } catch (e) {
    console.error('[memoria/cliente]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
