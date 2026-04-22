import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession } from '@/lib/auth'

// Query: chamados que apareceram em algum snapshot HOJE (>= 00:00 BRT)
// e NÃO aparecem no snapshot mais recente → foram resolvidos.
// Atribui ao último 'usuario_des' conhecido daquele chamado.
const QUERY_RESOLVIDOS_HOJE = `
WITH ultimo_ts AS (
  SELECT MAX(snapshot_ts) AS ts FROM chamados_snapshots
),
estado_final AS (
  SELECT DISTINCT ON (numero)
    numero, usuario_des, cliente, cod_cliente, bairro, tipo, topico, snapshot_ts
  FROM chamados_snapshots
  WHERE snapshot_ts >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date AT TIME ZONE 'America/Sao_Paulo'
  ORDER BY numero, snapshot_ts DESC
),
ainda_abertos AS (
  SELECT DISTINCT numero FROM chamados_snapshots
  WHERE snapshot_ts = (SELECT ts FROM ultimo_ts)
)
SELECT
  ef.numero, ef.usuario_des, ef.cliente, ef.cod_cliente,
  ef.bairro, ef.tipo, ef.topico, ef.snapshot_ts AS ultimo_visto
FROM estado_final ef
WHERE ef.numero NOT IN (SELECT numero FROM ainda_abertos)
ORDER BY ef.usuario_des NULLS LAST, ef.numero
`

async function handler(detalhar) {
  const { rows } = await query(QUERY_RESOLVIDOS_HOJE)
  // Agrupa por usuário
  const porUsuario = {}
  for (const r of rows) {
    const u = r.usuario_des || '(sem responsável)'
    if (!porUsuario[u]) porUsuario[u] = { usuario: u, total: 0, chamados: [] }
    porUsuario[u].total++
    porUsuario[u].chamados.push({
      numero: r.numero,
      cliente: r.cliente,
      cod_cliente: r.cod_cliente,
      bairro: r.bairro,
      tipo: r.tipo,
      topico: r.topico,
      ultimo_visto: r.ultimo_visto,
    })
  }
  const ranking = Object.values(porUsuario).sort((a, b) => b.total - a.total)

  // Texto pro bot consumir direto
  const resumoPorUser = ranking
    .map(r => `- ${r.usuario}: ${r.total} chamado${r.total > 1 ? 's' : ''}`)
    .join('\n')

  const detalhesLinhas = []
  for (const r of ranking) {
    for (const c of r.chamados) {
      const cliente = c.cod_cliente && c.cliente
        ? `${c.cod_cliente} - ${c.cliente}`
        : (c.cliente || c.cod_cliente || 'Sem cliente')
      const topico = [c.tipo, c.topico].filter(Boolean).join(' / ') || 'Sem tipo'
      detalhesLinhas.push(`- ${r.usuario} | ${cliente} | ${topico}`)
    }
  }

  const ai_text = ranking.length
    ? `Resolvidos hoje (${rows.length} no total):\n\n`
      + `POR RESPONSÁVEL:\n${resumoPorUser}\n\n`
      + `DETALHES (responsavel | codigo - cliente | tipo / topico):\n${detalhesLinhas.join('\n')}`
    : 'Nenhum chamado resolvido hoje (ou sem snapshots suficientes ainda).'

  return {
    total_resolvidos: rows.length,
    ranking,
    ai_text,
    detalhes: detalhar ? rows : undefined,
  }
}

export async function GET(req) {
  // Aceita auth de duas formas: token (pra n8n) OU sessão (pra dashboard)
  const url = new URL(req.url)
  const token = req.headers.get('x-auto-token') || url.searchParams.get('token')
  const tokenOk = token === (process.env.CHAMADOS_AUTO_TOKEN || 'CHAMADOS_AUTO_2026')

  if (!tokenOk) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const detalhar = url.searchParams.get('detalhes') === '1'
    const data = await handler(detalhar)
    return NextResponse.json(data)
  } catch (e) {
    console.error('GET /api/chamados/resolvidos-hoje:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
