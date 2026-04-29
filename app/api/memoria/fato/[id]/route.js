import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession, requireAdmin } from '@/lib/auth'

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = params
  const body = await request.json()
  const { fato, peso, ativo, validado_por } = body

  const sets = []
  const vals = []
  let i = 1

  if (fato     !== undefined) { sets.push(`fato = $${i++}`);          vals.push(fato.trim()) }
  if (peso     !== undefined) { sets.push(`peso = $${i++}`);          vals.push(Math.min(10, Math.max(1, parseInt(peso)))) }
  if (ativo    !== undefined) { sets.push(`ativo = $${i++}`);         vals.push(!!ativo) }
  if (validado_por !== undefined) { sets.push(`validado_por = $${i++}`); vals.push(validado_por || null) }

  if (sets.length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  vals.push(id)
  try {
    const result = await query(
      `UPDATE bot_memoria_longa SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    )
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Fato não encontrado' }, { status: 404 })
    }
    return NextResponse.json(result.rows[0])
  } catch (e) {
    console.error('[memoria/fato PATCH]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
