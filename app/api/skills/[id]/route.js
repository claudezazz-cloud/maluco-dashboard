import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PUT(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  try {
    const { nome, descricao, prompt_base, parametros_opcionais, ativo } = await req.json()
    if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    if (!prompt_base?.trim()) return NextResponse.json({ error: 'Prompt base obrigatório' }, { status: 400 })

    const nomeNormalizado = nome.trim().startsWith('/') ? nome.trim().toLowerCase() : '/' + nome.trim().toLowerCase()

    let paramsJson = '[]'
    if (parametros_opcionais !== undefined) {
      try {
        paramsJson = typeof parametros_opcionais === 'string' ? parametros_opcionais : JSON.stringify(parametros_opcionais)
        JSON.parse(paramsJson)
      } catch {
        return NextResponse.json({ error: 'parametros_opcionais deve ser JSON válido' }, { status: 400 })
      }
    }

    await query(
      'UPDATE dashboard_skills SET nome=$1, descricao=$2, prompt_base=$3, parametros_opcionais=$4, ativo=$5 WHERE id=$6',
      [nomeNormalizado, descricao?.trim() || null, prompt_base.trim(), paramsJson, ativo ?? true, params.id]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e.code === '23505') {
      return NextResponse.json({ error: 'Já existe uma skill com esse nome' }, { status: 409 })
    }
    console.error('PUT /skills/[id]:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  try {
    await query('DELETE FROM dashboard_skills WHERE id = $1', [params.id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /skills/[id]:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
