import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession, requireAdmin } from '@/lib/auth'

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { tipo, id } = params

  try {
    const result = await query(
      `SELECT id, entidade_tipo, entidade_id, fato, categoria, peso, ocorrencias,
              primeira_ocorrencia, ultima_ocorrencia, ativo, validado_por
       FROM bot_memoria_longa
       WHERE entidade_tipo = $1 AND entidade_id = $2
       ORDER BY peso DESC, ocorrencias DESC`,
      [tipo, decodeURIComponent(id)]
    )
    return NextResponse.json(result.rows)
  } catch (e) {
    console.error('[memoria/entidade]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
