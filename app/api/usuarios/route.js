import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { getSession, requireAdmin } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const result = await query(
    'SELECT id, email, nome, role, ativo, criado_em FROM dashboard_usuarios ORDER BY criado_em DESC'
  )
  return NextResponse.json(result.rows)
}

export async function POST(request) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await request.json()
  const { email, nome, senha, role } = body

  if (!email || !nome || !senha) {
    return NextResponse.json({ error: 'Campos obrigatórios: email, nome, senha' }, { status: 400 })
  }

  const allowedRoles = ['admin', 'colaborador']
  const userRole = allowedRoles.includes(role) ? role : 'colaborador'

  try {
    const existing = await query('SELECT id FROM dashboard_usuarios WHERE email = $1', [email.toLowerCase()])
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 })
    }

    const hash = await bcrypt.hash(senha, 10)
    const result = await query(
      'INSERT INTO dashboard_usuarios (email, senha_hash, nome, role) VALUES ($1, $2, $3, $4) RETURNING id, email, nome, role, ativo, criado_em',
      [email.toLowerCase().trim(), hash, nome.trim(), userRole]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao criar usuário: ' + e.message }, { status: 500 })
  }
}
