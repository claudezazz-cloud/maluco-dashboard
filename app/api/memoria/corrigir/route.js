import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026'

// POST /api/memoria/corrigir — usado pelo bot (tool corrigir_fato) quando o
// usuario aponta que um fato salvo esta errado.
//
// Body:
//   { entidade_tipo, entidade_id, busca: "trecho do fato errado", novo_fato?: "...", peso?: 7 }
//
// Estrategia:
// 1. ILIKE %busca% em fato dentro de (entidade_tipo, entidade_id)
// 2. SET ativo=false nos matches (preserva historico)
// 3. Se novo_fato fornecido, INSERT com validado_por='user' (peso default 7)
export async function POST(req) {
  const tok = req.headers.get('x-token')
  if (tok !== TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  try {
    const { entidade_tipo, entidade_id, busca, novo_fato, peso = 7 } = await req.json()
    if (!entidade_tipo || !entidade_id || !busca) {
      return NextResponse.json({ error: 'entidade_tipo, entidade_id e busca obrigatorios' }, { status: 400 })
    }

    // Desativa fatos que dao match
    const desativar = await query(
      `UPDATE bot_memoria_longa
       SET ativo = false
       WHERE entidade_tipo = $1 AND entidade_id = $2 AND fato ILIKE '%' || $3 || '%' AND ativo = true
       RETURNING id, fato`,
      [entidade_tipo, entidade_id.trim().substring(0, 100), busca.trim().substring(0, 200)]
    )

    let novo = null
    if (novo_fato) {
      const r = await query(
        `INSERT INTO bot_memoria_longa (entidade_tipo, entidade_id, fato, peso, validado_por)
         VALUES ($1, $2, $3, $4, 'user')
         ON CONFLICT (entidade_tipo, entidade_id, fato)
         DO UPDATE SET ativo = true,
                       peso = GREATEST(bot_memoria_longa.peso, EXCLUDED.peso),
                       validado_por = 'user',
                       ultima_ocorrencia = NOW(),
                       ocorrencias = bot_memoria_longa.ocorrencias + 1
         RETURNING id, peso, ocorrencias`,
        [entidade_tipo, entidade_id.trim().substring(0, 100), novo_fato.trim().substring(0, 1000), Math.max(1, Math.min(10, peso))]
      )
      novo = r.rows[0]
    }

    return NextResponse.json({
      ok: true,
      desativados: desativar.rows.length,
      desativados_detalhes: desativar.rows.map(r => r.fato.substring(0, 80)),
      novo,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
