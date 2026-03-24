import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { signToken } from '@/lib/auth'

export async function POST(req) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 })
    }

    const result = await query(
      'SELECT * FROM dashboard_usuarios WHERE email = $1 AND ativo = true',
      [email.toLowerCase()]
    )

    const user = result.rows[0]
    if (!user) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.senha_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    const token = signToken({ id: user.id, email: user.email, nome: user.nome, role: user.role })

    const response = NextResponse.json({ ok: true, role: user.role, nome: user.nome })
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
      sameSite: 'lax',
    })
    return response
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
