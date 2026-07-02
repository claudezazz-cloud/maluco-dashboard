import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

// POST /api/lembretes/detectar-promessas?dry=0&horas=0
// Detecta PROMESSAS da equipe nas mensagens do grupo ("amanhã eu vejo", "vou combinar
// um horário pra amanhã", "segunda instalo") e agenda um lembrete automático no MESMO
// grupo pro dia prometido. Roda por cron (30 em 30 min). Claude Haiku extrai; tudo é
// validado de forma estrita antes de agendar (anti-alucinação / anti-prompt-injection).
//
// Endurecida após revisão adversarial (02/07/2026):
// - LLM processa POR GRUPO (transcript nunca mistura grupos; lembrete só pode cair no
//   grupo das próprias mensagens — bloqueia fabricação cross-grupo).
// - Cap de 5/run NÃO perde as excedentes: o cursor retrocede pro min(msg_id) restante.
// - pushName (remetente) sanitizado no texto do lembrete (anti @mention forjada).
// - Lembrete só dispara em horário comercial (07:30–18:30 BRT); domingo -> segunda.
// - fetch à Anthropic com timeout de 60s.
//
// - Cursor em dashboard_config ('promessas_cursor_msg_id'): cada run só lê mensagens NOVAS.
// - ?dry=1: mostra o que detectaria SEM agendar nem avançar o cursor.
// - ?horas=N (só com dry=1): ignora o cursor e olha as últimas N horas (teste/backfill).
// - Dedup: dedup_key = 'promessa:<message_id>' (UNIQUE) — a mesma mensagem nunca gera 2x.
const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || ''
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_LEMBRETES_POR_RUN = 5
const CURSOR_CHAVE = 'promessas_cursor_msg_id'

// Pré-filtro barato: só chama o LLM se alguma mensagem tem cara de promessa.
const GATILHO = /amanh[ãa]|semana\s+que\s+vem|mais\s+tarde|logo\s+mais|depois\s+eu|vou\s+(ver|passar|combinar|resolver|arrumar|instalar|levar|buscar|ir|fazer|agendar|marcar|verificar)|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|assim\s+que|qualquer\s+hora|deixa\s+comigo/i

// BRT helpers
function brtNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
}
function brtOf(date) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
}
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const sanit = (s, max) => String(s || '').replace(/[@*_`\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

// Horário comercial: lembrete só dispara 07:30–18:30 BRT; fora disso vai pra 08:30 do
// dia (se antes das 07:30) ou do dia seguinte (se depois das 18:30). Domingo -> segunda.
function normalizarAgendamento(agendar) {
  let brt = brtOf(agendar)
  const frac = brt.getHours() + brt.getMinutes() / 60
  if (frac < 7.5) {
    agendar = new Date(`${ymd(brt)}T08:30:00-03:00`)
  } else if (frac > 18.5) {
    const nx = new Date(brt.getFullYear(), brt.getMonth(), brt.getDate() + 1)
    agendar = new Date(`${ymd(nx)}T08:30:00-03:00`)
  }
  if (brtOf(agendar).getDay() === 0) agendar = new Date(agendar.getTime() + 24 * 3600 * 1000)
  return agendar
}

function montarPromptSistema() {
  const hoje = brtNow()
  const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
  const cal = []
  for (let i = 0; i < 8; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i)
    const label = i === 0 ? ' (HOJE)' : i === 1 ? ' (AMANHÃ)' : ''
    cal.push(`${ymd(d)} = ${dias[d.getDay()]}${label}`)
  }
  return `Você lê mensagens de UM grupo interno de uma provedora de internet (Zazz, Lunardelli-PR). Os participantes são FUNCIONÁRIOS.

Tarefa: identificar PROMESSAS/compromissos de trabalho com execução FUTURA — ex.: "amanhã eu passo lá", "vou combinar um horário pra amanhã", "segunda instalo", "semana que vem resolvo", "mais tarde eu vejo isso".

CALENDÁRIO (use para converter "amanhã", "segunda" etc. em data):
${cal.join('\n')}

Regras:
- Só compromissos de TRABALHO com ação futura clara. IGNORE: conversa casual/futebol/piada, perguntas, ações imediatas ("tô fazendo agora", "já resolvi"), mensagens do bot/rotinas, e promessas de CLIENTES (só da equipe).
- IMPORTANTE: expressões relativas ("amanhã", "segunda") contam a partir da DATA DA MENSAGEM (o [DD/MM HH:MM] da linha), NÃO da data de hoje. Ex.: mensagem de 01/07 dizendo "amanhã" ⇒ quando = 02/07 (mesmo que hoje já seja 02/07). Se a data resultante já passou, use a data de HOJE.
- "quando" = a data prometida (YYYY-MM-DD, do calendário acima). Se disser só "amanhã" sem hora, hora = null. Se falar hora ("às 14h"), hora = "HH:MM".
- Se a promessa não tiver prazo identificável (ex.: "depois eu vejo" sem quando), use o dia seguinte.
- "promessa" = resumo curto (máx 15 palavras) do que a pessoa se comprometeu a fazer, citando o cliente se houver.
- "msg_id" = o id EXATO da linha da mensagem da promessa (copie do transcript).

Responda APENAS com um JSON array (sem texto fora dele):
[{"msg_id": 123, "autor": "nome como no transcript", "promessa": "...", "quando": "YYYY-MM-DD", "hora": "HH:MM" ou null}]
Se não houver promessas, responda [].`
}

async function extrairComClaude(transcript) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1500, system: montarPromptSistema(),
      messages: [{ role: 'user', content: 'Mensagens do grupo:\n\n' + transcript }],
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error('Anthropic ' + res.status + ': ' + (await res.text()).slice(0, 200))
  const data = await res.json()
  let txt = (data.content || []).map(c => c.text || '').join('').trim()
  txt = txt.replace(/^```(json)?/i, '').replace(/```$/, '').trim()
  const ini = txt.indexOf('['), fim = txt.lastIndexOf(']')
  if (ini < 0 || fim < 0) return []
  try { return JSON.parse(txt.slice(ini, fim + 1)) } catch { return [] }
}

// autor (pushName do WhatsApp) -> numero pra @mention real. Agrupa por COLABORADOR:
// se exatamente 1 colaborador casa, usa o número 'principal' dele (ou o primeiro).
// Ambíguo/não achou => null (o lembrete usa só o nome, sem @ — nunca inventa número).
function acharNumero(autor, colabs) {
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const toks = norm(autor).split(/[^a-z0-9]+/).filter(t => t.length >= 3)
  const porColab = new Map()
  for (const c of colabs) {
    if (!porColab.has(c.cid)) porColab.set(c.cid, { nome: c.nome, numeros: [] })
    porColab.get(c.cid).numeros.push({ numero: c.numero, apelido: c.apelido || '' })
    porColab.get(c.cid).nome += ' ' + (c.apelido || '')
  }
  // score: 1º token do pushName vale 2 (é o "nome de verdade" — "Russo Zazz" tem que
  // casar Russo, não o colaborador "Plantão Zazz"); vence só se houver máximo ÚNICO.
  const scored = []
  for (const [cid, info] of porColab) {
    const nomeToks = norm(info.nome).split(/[^a-z0-9]+/).filter(t => t.length >= 3)
    let score = 0
    for (const t of toks) if (nomeToks.includes(t)) score += (t === toks[0] ? 2 : 1)
    if (score > 0) scored.push({ info, score })
  }
  if (!scored.length) return null
  scored.sort((a, b) => b.score - a.score)
  if (scored.length > 1 && scored[0].score === scored[1].score) return null // empate = ambíguo
  const win = scored[0].info
  const principal = win.numeros.find(n => /principal/i.test(n.apelido))
  return (principal || win.numeros[0]).numero
}

export async function POST(req) {
  if (req.headers.get('x-token') !== TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!ANTHROPIC_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const dry = searchParams.get('dry') === '1'
  const horas = Math.min(Math.max(parseInt(searchParams.get('horas') || '0', 10) || 0, 0), 168)
  if (horas && !dry) return NextResponse.json({ error: '?horas só é permitido com dry=1 (evita backfill real acidental)' }, { status: 400 })

  try {
    // garante coluna/constraint de dedup (idempotente — mesmo padrão do cobrar)
    await query(`ALTER TABLE mensagens_agendadas ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(255)`)
    await query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_mensagens_dedup') THEN
        ALTER TABLE mensagens_agendadas ADD CONSTRAINT uk_mensagens_dedup UNIQUE (dedup_key);
      END IF; END $$`)

    // cursor
    let cursor = 0
    try {
      const c = await query(`SELECT valor FROM dashboard_config WHERE chave = $1`, [CURSOR_CHAVE])
      cursor = parseInt(c.rows[0]?.valor || '0', 10) || 0
    } catch {}

    // mensagens candidatas (só grupos; sem bot/rotinas/lembretes; janela de segurança 26h)
    const where = horas
      ? `m.data_hora > NOW() - ($1 || ' hours')::interval`
      : `m.id > $1 AND m.data_hora > NOW() - INTERVAL '26 hours'`
    const msgs = await query(
      `SELECT m.id, m.remetente, m.mensagem, m.chat_id,
              to_char(m.data_hora AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI') AS quando_str
       FROM mensagens m
       WHERE m.chat_id LIKE '%@g.us'
         AND LENGTH(m.mensagem) BETWEEN 12 AND 1500
         AND COALESCE(m.remetente,'') NOT ILIKE '%maluco%'
         AND COALESCE(m.remetente,'') NOT ILIKE '%agendamento%'
         AND m.mensagem NOT LIKE '/%'
         AND m.mensagem NOT LIKE '🔔%'
         AND ${where}
       ORDER BY m.id ASC
       LIMIT 300`,
      [horas ? String(horas) : cursor]
    )
    const rows = msgs.rows
    const maxId = rows.length ? Math.max(...rows.map(r => Number(r.id))) : cursor

    const out = { ok: true, dry, cursor_anterior: cursor, lidas: rows.length, detectadas: 0, criadas: 0, pulados: [], detalhes: [] }

    // grupos registrados (lembrete só pode cair em grupo ativo; mensagens de chats não
    // registrados são ignoradas — não têm onde receber lembrete)
    const gruposDb = (await query(`SELECT id, nome, chat_id FROM grupos_whatsapp WHERE ativo = true`)).rows
    const grupoPorChat = new Map(gruposDb.map(g => [g.chat_id, g]))

    // agrupa POR GRUPO: o LLM nunca vê mensagens de grupos misturados (anti cross-grupo)
    const porGrupo = new Map()
    for (const r of rows) {
      if (!grupoPorChat.has(r.chat_id)) continue
      if (!porGrupo.has(r.chat_id)) porGrupo.set(r.chat_id, [])
      porGrupo.get(r.chat_id).push(r)
    }
    const gruposCandidatos = [...porGrupo.entries()]
      .filter(([, rs]) => rs.some(r => GATILHO.test(r.mensagem)))
      .sort((a, b) => Math.min(...a[1].map(r => Number(r.id))) - Math.min(...b[1].map(r => Number(r.id))))

    if (!rows.length || !gruposCandidatos.length) {
      if (!dry && maxId > cursor) await salvarCursor(maxId)
      out.msg = rows.length ? 'Nenhuma mensagem com cara de promessa (LLM não chamado).' : 'Sem mensagens novas.'
      return NextResponse.json(out)
    }

    // colaboradores pra @mention (c.id junto pra agrupar múltiplos números por pessoa)
    const colabs = (await query(
      `SELECT c.id AS cid, c.nome, cn.numero, cn.apelido FROM dashboard_colaboradores c
       JOIN colaboradores_numeros cn ON cn.colaborador_id = c.id WHERE c.ativo = true`
    )).rows

    const hojeBrt = brtNow()
    const hojeYmd = ymd(hojeBrt)
    const limiteYmd = ymd(new Date(hojeBrt.getFullYear(), hojeBrt.getMonth(), hojeBrt.getDate() + 30))

    let cursorRetomada = null // setado se o cap estourar (pra não perder promessas)
    let capEstourou = false

    for (let gi = 0; gi < gruposCandidatos.length && !capEstourou; gi++) {
      const [chatId, grows] = gruposCandidatos[gi]
      const grupo = grupoPorChat.get(chatId)
      const porId = new Map(grows.map(r => [Number(r.id), r]))
      const transcript = grows
        .map(r => `[id=${r.id}] [${r.quando_str}] ${r.remetente}: ${String(r.mensagem).replace(/\s+/g, ' ').slice(0, 280)}`)
        .join('\n').slice(0, 12000)

      const promessas = await extrairComClaude(transcript)
      const lista = Array.isArray(promessas) ? promessas : []
      out.detectadas += lista.length

      for (let pi = 0; pi < lista.length; pi++) {
        const p = lista[pi]
        // validação ESTRITA de tudo que veio do LLM
        const src = porId.get(Number(p.msg_id)) // msg TEM que ser deste grupo
        if (!src) { out.pulados.push({ promessa: sanit(p.promessa, 60), motivo: 'msg_id não é deste grupo/lote' }); continue }

        if (out.criadas >= MAX_LEMBRETES_POR_RUN) {
          // cap: NÃO descarta — cursor volta pro início do que ficou sem processar
          const restantes = [
            ...lista.slice(pi).map(x => Number(x.msg_id)).filter(id => porId.has(id)),
            ...gruposCandidatos.slice(gi + 1).flatMap(([, rs]) => rs.map(r => Number(r.id))),
          ]
          if (restantes.length) cursorRetomada = Math.max(cursor, Math.min(...restantes) - 1)
          out.pulados.push({ motivo: `cap de ${MAX_LEMBRETES_POR_RUN}/run — restante fica pro próximo run` })
          capEstourou = true
          break
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(p.quando || '') || p.quando < hojeYmd || p.quando > limiteYmd) {
          out.pulados.push({ promessa: sanit(p.promessa, 60), motivo: 'data inválida/fora da janela: ' + p.quando }); continue
        }
        const hora = (typeof p.hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(p.hora)) ? p.hora : '08:30'
        const promessa = sanit(p.promessa, 180)
        if (promessa.length < 5) { out.pulados.push({ motivo: 'promessa vazia/curta' }); continue }

        // agenda: data prometida às HH:MM BRT; se já passou, daqui a 2h; depois clamp
        // pra horário comercial + desvio de domingo
        let agendar = new Date(`${p.quando}T${hora}:00-03:00`)
        if (agendar.getTime() <= Date.now()) agendar = new Date(Date.now() + 2 * 3600 * 1000)
        agendar = normalizarAgendamento(agendar)

        const numero = acharNumero(src.remetente, colabs)
        const quemNome = sanit(src.remetente, 40) || 'alguém'
        const quem = numero ? `@${numero}` : quemNome
        const mensagem = `🔔 *Lembrete automático*\n${quem}, em ${src.quando_str} você disse: "_${promessa}_"\nJá foi feito? Se sim, ignora — se não, fica o toque. 🍀`

        out.detalhes.push({ autor: quemNome, promessa, quando: p.quando, hora, grupo: grupo.nome, agendar_para: agendar.toISOString(), mention: !!numero })
        if (dry) continue

        const r = await query(
          `INSERT INTO mensagens_agendadas (grupo_id, mensagem, agendar_para, criado_por, status, dedup_key)
           VALUES ($1, $2, $3, 'detector-promessas', 'pendente', $4)
           ON CONFLICT (dedup_key) DO NOTHING`,
          [grupo.id, mensagem, agendar.toISOString(), `promessa:${src.id}`]
        )
        if (r.rowCount > 0) out.criadas++
      }
    }

    if (!dry) {
      const novoCursor = capEstourou && cursorRetomada !== null ? cursorRetomada : maxId
      if (novoCursor > cursor) await salvarCursor(novoCursor)
      out.cursor_novo = capEstourou && cursorRetomada !== null ? cursorRetomada : maxId
    }
    return NextResponse.json(out)
  } catch (e) {
    console.error('[detectar-promessas]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

async function salvarCursor(id) {
  await query(
    `INSERT INTO dashboard_config (chave, valor, atualizado_em) VALUES ($1, $2, NOW())
     ON CONFLICT (chave) DO UPDATE SET valor = $2, atualizado_em = NOW()`,
    [CURSOR_CHAVE, String(id)]
  )
}
