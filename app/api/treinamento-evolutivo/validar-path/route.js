import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { validarPath } from '@/lib/evolutivo/reader'
import fs from 'fs/promises'

export async function POST(req) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { pasta } = await req.json()
  if (!pasta) return NextResponse.json({ error: 'Campo pasta é obrigatório' }, { status: 400 })

  const vp = validarPath(pasta)
  if (!vp.ok) return NextResponse.json({ ok: false, erro: vp.erro }, { status: 400 })

  try {
    const stat = await fs.stat(vp.abs)
    if (!stat.isDirectory()) return NextResponse.json({ ok: false, erro: 'O caminho existe mas não é uma pasta.' }, { status: 400 })
    const files = await fs.readdir(vp.abs)
    const mdCount = files.filter(f => f.endsWith('.md')).length
    return NextResponse.json({ ok: true, abs: vp.abs, mdCount })
  } catch {
    return NextResponse.json({ ok: false, erro: 'Pasta não encontrada ou sem permissão de leitura.' }, { status: 400 })
  }
}
