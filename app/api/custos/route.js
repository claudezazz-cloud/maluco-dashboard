import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession, requireAdmin } from '@/lib/auth'

// GET /api/custos — gasto de tokens/custo estimado do bot (admin).
// bot_conversas guarda tokens_input/output por interação (sem o modelo), então o custo
// é ESTIMADO assumindo Claude Haiku 4.5. Tokens são exatos; o $ é aproximado.
const IN_USD = 1.0    // Haiku 4.5 input  — US$/milhão de tokens (estimativa, ajustável)
const OUT_USD = 5.0   // Haiku 4.5 output — US$/milhão de tokens
const USD_BRL = 5.40  // câmbio aproximado

function custo(inp, out) {
  const usd = (Number(inp || 0) / 1e6) * IN_USD + (Number(out || 0) / 1e6) * OUT_USD
  return { usd: +usd.toFixed(2), brl: +(usd * USD_BRL).toFixed(2) }
}

export async function GET() {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  try {
    const hojeR = await query(`
      SELECT COALESCE(SUM(tokens_input),0)::bigint i, COALESCE(SUM(tokens_output),0)::bigint o, COUNT(*)::int n
      FROM bot_conversas
      WHERE (criado_em AT TIME ZONE 'America/Sao_Paulo')::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date`)
    const mesR = await query(`
      SELECT COALESCE(SUM(tokens_input),0)::bigint i, COALESCE(SUM(tokens_output),0)::bigint o, COUNT(*)::int n
      FROM bot_conversas
      WHERE (criado_em AT TIME ZONE 'America/Sao_Paulo') >= date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')`)
    const diasR = await query(`
      SELECT to_char((criado_em AT TIME ZONE 'America/Sao_Paulo')::date,'DD/MM') dia,
             COALESCE(SUM(tokens_input),0)::bigint i, COALESCE(SUM(tokens_output),0)::bigint o, COUNT(*)::int n
      FROM bot_conversas
      WHERE (criado_em AT TIME ZONE 'America/Sao_Paulo') >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date - INTERVAL '13 days'
      GROUP BY 1, (criado_em AT TIME ZONE 'America/Sao_Paulo')::date
      ORDER BY (criado_em AT TIME ZONE 'America/Sao_Paulo')::date`)

    const h = hojeR.rows[0], m = mesR.rows[0]
    const dias = diasR.rows.map(d => ({
      dia: d.dia, msgs: d.n, tokens: Number(d.i) + Number(d.o), custo: custo(d.i, d.o),
    }))
    const mediaMsg = m.n > 0 ? Math.round((Number(m.i) + Number(m.o)) / m.n) : 0

    return NextResponse.json({
      hoje: { tokens_input: Number(h.i), tokens_output: Number(h.o), msgs: h.n, custo: custo(h.i, h.o) },
      mes: { tokens_input: Number(m.i), tokens_output: Number(m.o), msgs: m.n, custo: custo(m.i, m.o), media_tokens_msg: mediaMsg },
      dias,
      rates: { in_usd_milhao: IN_USD, out_usd_milhao: OUT_USD, usd_brl: USD_BRL, modelo: 'Haiku 4.5 (estimativa)' },
    })
  } catch (e) {
    console.error('[custos]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
