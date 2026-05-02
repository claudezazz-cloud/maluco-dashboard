import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026'

// POST /api/memoria/aprender — usado pelo bot (tool aprender_fato) pra salvar
// fato durável em bot_memoria_longa. Idempotente: bate UNIQUE em (tipo,id,fato),
// se ja existe incrementa ocorrencias e ultima_ocorrencia.
export async function POST(req) {
  const tok = req.headers.get('x-token')
  if (tok !== TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  try {
    const { entidade_tipo, entidade_id, fato, peso = 5, categoria = null } = await req.json()
    if (!entidade_tipo || !entidade_id || !fato) {
      return NextResponse.json({ error: 'entidade_tipo, entidade_id e fato obrigatorios' }, { status: 400 })
    }
    const r = await query(
      `INSERT INTO bot_memoria_longa (entidade_tipo, entidade_id, fato, peso, categoria)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (entidade_tipo, entidade_id, fato)
       DO UPDATE SET ocorrencias = bot_memoria_longa.ocorrencias + 1,
                     ultima_ocorrencia = NOW(),
                     peso = GREATEST(bot_memoria_longa.peso, EXCLUDED.peso),
                     ativo = true
       RETURNING id, ocorrencias, peso`,
      [entidade_tipo, entidade_id.trim().substring(0, 100), fato.trim().substring(0, 1000), Math.max(1, Math.min(10, peso)), categoria]
    )
    return NextResponse.json({ ok: true, ...r.rows[0] })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
