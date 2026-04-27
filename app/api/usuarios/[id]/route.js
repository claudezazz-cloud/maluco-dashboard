import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { getSession, requireAdmin } from '@/lib/auth'

export async function PUT(request, context) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await context.params
  const isSelf = String(session.id) === String(id)

  // Apenas admin pode editar outros usuários
  if (!isSelf && !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await request.json()
  const { nome, email, role, ativo, senha } = body

  if (!nome?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  if (!email?.trim()) return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 })

  // Colaborador editando a si mesmo só pode mudar nome e senha (não email, não role, não ativo)
  const finalRole = requireAdmin(session) ? role : session.role
  const finalAtivo = requireAdmin(session) ? ativo : true
  const finalEmail = requireAdmin(session) ? email.toLowerCase().trim() : session.email

  try {
    if (senha) {
      const hash = await bcrypt.hash(senha, 10)
      const result = await query(
        'UPDATE dashboard_usuarios SET nome = $1, email = $2, role = $3, ativo = $4, senha_hash = $5 WHERE id = $6 RETURNING id, email, nome, role, ativo, criado_em',
        [nome.trim(), finalEmail, finalRole, finalAtivo, hash, id]
      )
      if (result.rows.length === 0) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
      return NextResponse.json(result.rows[0])
    }

    const result = await query(
      'UPDATE dashboard_usuarios SET nome = $1, email = $2, role = $3, ativo = $4 WHERE id = $5 RETURNING id, email, nome, role, ativo, criado_em',
      [nome.trim(), finalEmail, finalRole, finalAtivo, id]
    )
    if (result.rows.length === 0) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao atualizar: ' + e.message }, { status: 500 })
  }
}

export async function DELETE(request, context) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await context.params

  if (String(session.id) === String(id)) {
    return NextResponse.json({ error: 'Não é possível excluir seu próprio usuário' }, { status: 400 })
  }

  await query('UPDATE dashboard_usuarios SET ativo = false WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}
