import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

// POST /api/memoria/extrair-clientes?horas=24&dry=0
// Lê as mensagens do grupo nas últimas N horas, pede ao Claude pra extrair UM fato durável
// para CADA cliente mencionado com evento/informação, casa o nome com dashboard_clientes
// (pra ter o código) e grava em bot_memoria_longa. Alimenta a tool historico_cliente.
// Roda por cron 1x/dia. Token-protected. ?dry=1 mostra o que extrairia SEM salvar.
const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || ''
const MODEL = 'claude-haiku-4-5-20251001'
const CATEGORIAS = ['problema', 'venda', 'processo', 'financeiro', 'preferencia', 'contexto']

const SYS = `Você lê mensagens do grupo interno de uma provedora de internet (Zazz, fibra óptica, Lunardelli-PR). Os participantes são FUNCIONÁRIOS falando sobre CLIENTES.

Tarefa: para CADA cliente mencionado que tenha um EVENTO ou INFORMAÇÃO útil (sem internet, lentidão, queda/LOS, instalação, visita técnica, agendamento, mudança de endereço, troca de equipamento, upgrade/downgrade de plano, cancelamento, pagamento/cobrança/inadimplência, reclamação, elogio, preferência), extraia UM fato curto, durável e ATEMPORAL.

Regras:
- Só registre se houver um cliente E um evento/informação. Ignore saudações e conversa sem cliente.
- Se a mensagem cita o código do cliente (ex.: "47211 - Fulano", "cod 47211"), coloque em "codigo".
- Fato conciso (1 frase), SEM data, durável (ex.: "Relatou quedas frequentes de sinal", não "Hoje caiu").
- categoria: um de [problema, venda, processo, financeiro, preferencia, contexto].
- NÃO invente. Só o que está nas mensagens.

Responda APENAS com um JSON array (sem texto fora dele):
[{"cliente":"nome como aparece","codigo":"se citado senão vazio","fato":"...","categoria":"..."}]
Se nada relevante, responda [].`

async function extrairComClaude(transcript) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 3000, system: SYS,
      messages: [{ role: 'user', content: 'Mensagens do grupo:\n\n' + transcript }],
    }),
  })
  if (!res.ok) throw new Error('Anthropic ' + res.status + ': ' + (await res.text()).slice(0, 200))
  const data = await res.json()
  let txt = (data.content || []).map(c => c.text || '').join('').trim()
  txt = txt.replace(/^```(json)?/i, '').replace(/```$/, '').trim()
  const ini = txt.indexOf('['), fim = txt.lastIndexOf(']')
  if (ini < 0 || fim < 0) return []
  try { return JSON.parse(txt.slice(ini, fim + 1)) } catch { return [] }
}

// Casa o fato a um cliente real (pra ter o código). Conservador: só aceita match seguro,
// senão pula (não quer atribuir fato ao cliente errado).
async function resolverCliente(nome, codigo) {
  if (codigo && /^\d{2,6}$/.test(String(codigo).trim())) {
    const r = await query('SELECT cod, nome FROM dashboard_clientes WHERE ativo=true AND cod=$1 LIMIT 1', [String(codigo).trim()])
    if (r.rows[0]) return r.rows[0]
  }
  const nm = (nome || '').trim()
  if (nm.length < 3) return null
  // 1) nome exato (sem acento)
  let r = await query('SELECT cod, nome FROM dashboard_clientes WHERE ativo=true AND unaccent(LOWER(nome))=unaccent(LOWER($1))', [nm])
  if (r.rows.length === 1) return r.rows[0]
  // 2) prefixo único (ex.: "Lucas Porto" -> "Lucas Porto de Oliveira")
  r = await query("SELECT cod, nome FROM dashboard_clientes WHERE ativo=true AND unaccent(LOWER(nome)) LIKE unaccent(LOWER($1)) || '%'", [nm])
  if (r.rows.length === 1) return r.rows[0]
  // 3) fuzzy seguro: mesmo PRIMEIRO e ÚLTIMO nome, e único (pega "Rafael Fernando Fitz"
  //    -> "Rafael Fernandes Fitz"; "Fernando"/"Fernandes" diferem mas 1º+último batem).
  const toks = nm.split(/\s+/).filter(t => t.length >= 3)
  if (toks.length >= 2) {
    const first = toks[0], last = toks[toks.length - 1]
    r = await query(
      `SELECT cod, nome FROM dashboard_clientes
       WHERE ativo=true
         AND unaccent(LOWER(nome)) LIKE '%' || unaccent(LOWER($1)) || '%'
         AND unaccent(LOWER(nome)) LIKE '%' || unaccent(LOWER($2)) || '%'`,
      [first, last]
    )
    if (r.rows.length === 1) return r.rows[0]
  }
  return null // ambíguo ou não encontrado -> pula
}

export async function POST(req) {
  if (req.headers.get('x-token') !== TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!ANTHROPIC_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const horas = Math.min(Math.max(parseInt(searchParams.get('horas') || '24', 10), 1), 168)
  const dry = searchParams.get('dry') === '1'

  try {
    // Mensagens de grupos nas últimas N horas (ignora curtas e do próprio bot)
    const msgs = await query(
      `SELECT remetente, mensagem
       FROM mensagens
       WHERE data_hora > NOW() - ($1 || ' hours')::interval
         AND chat_id LIKE '%@g.us'
         AND LENGTH(mensagem) > 8
         AND COALESCE(remetente,'') NOT ILIKE '%maluco%'
       ORDER BY data_hora ASC
       LIMIT 600`,
      [String(horas)]
    )
    if (msgs.rows.length < 4) {
      return NextResponse.json({ ok: true, lidas: msgs.rows.length, msg: 'Poucas mensagens — nada a extrair.' })
    }

    const transcript = msgs.rows
      .map(m => `${m.remetente || '?'}: ${(m.mensagem || '').slice(0, 300)}`)
      .join('\n')
      .slice(0, 24000)

    const fatos = await extrairComClaude(transcript)

    const out = { ok: true, dry, lidas: msgs.rows.length, extraidos: fatos.length, salvos: 0, atualizados: 0, pulados: [], detalhes: [] }
    for (const f of fatos) {
      const fato = (f.fato || '').trim()
      if (!fato) continue
      const cat = CATEGORIAS.includes(f.categoria) ? f.categoria : 'contexto'
      const cli = await resolverCliente(f.cliente, f.codigo)
      if (!cli) { out.pulados.push({ cliente: f.cliente, fato, motivo: 'cliente não casou' }); continue }
      const entidadeId = `${cli.cod} - ${cli.nome}`
      out.detalhes.push({ entidade_id: entidadeId, fato, categoria: cat })
      if (dry) continue
      const r = await query(
        `INSERT INTO bot_memoria_longa (entidade_tipo, entidade_id, fato, categoria, peso, ocorrencias, primeira_ocorrencia, ultima_ocorrencia, ativo)
         VALUES ('cliente', $1, $2, $3, 5, 1, NOW(), NOW(), true)
         ON CONFLICT (entidade_tipo, entidade_id, fato)
         DO UPDATE SET ocorrencias = bot_memoria_longa.ocorrencias + 1, ultima_ocorrencia = NOW()
         RETURNING (xmax = 0) AS inserido`,
        [entidadeId, fato, cat]
      )
      if (r.rows[0]?.inserido) out.salvos++; else out.atualizados++
    }
    return NextResponse.json(out)
  } catch (e) {
    console.error('[extrair-clientes]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
