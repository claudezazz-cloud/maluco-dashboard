import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026'
const NOTION_TOKEN = process.env.NOTION_TOKEN
const NOTION_DB = 'd54e5911e8af43dfaed8f2893e59f6ef'

// Busca tarefas Parado com entrega <= hoje, com paginação completa
async function fetchTarefasVencidas(hoje) {
  const results = []
  let hasMore = true
  let startCursor = undefined

  while (hasMore) {
    const body = {
      filter: {
        and: [
          { property: 'status', select: { equals: 'Parado' } },
          { property: 'Entrega', date: { on_or_before: hoje } },
        ],
      },
      sorts: [{ property: 'Entrega', direction: 'ascending' }],
      page_size: 100,
    }
    if (startCursor) body.start_cursor = startCursor

    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Notion error: ${err.substring(0, 200)}`)
    }

    const data = await res.json()
    results.push(...(data.results || []))
    hasMore = data.has_more || false
    startCursor = data.next_cursor
  }

  return results
}

// POST /api/tarefas/cobrar
// Chamado via cron VPS às 08h15 seg-sáb.
// Idempotente: usa ON CONFLICT DO NOTHING com dedup_key (data:grupo_id) para não duplicar.
export async function POST(req) {
  const tok = req.headers.get('x-token')
  if (tok !== TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Garante coluna dedup_key para idempotência
  await query(`ALTER TABLE mensagens_agendadas ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(255)`)
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_mensagens_dedup ON mensagens_agendadas(dedup_key) WHERE dedup_key IS NOT NULL`)

  try {
    const hoje = new Date().toISOString().split('T')[0]
    const tarefas = await fetchTarefasVencidas(hoje)

    if (tarefas.length === 0) {
      return NextResponse.json({ ok: true, msg: 'Nenhuma tarefa vencida encontrada.', enviadas: 0 })
    }

    // Parseia cada tarefa
    const parsed = tarefas.map(p => {
      const props = p.properties || {}
      const tipos = (props['Tipo']?.multi_select || []).map(t => t.name)
      const resp  = (props['Responsável']?.people || []).map(pe => pe.name).join(', ')
      const desc  = props['Descrição']?.title?.map(t => t.plain_text).join('') || '(sem descrição)'
      const cli   = props['Cliente']?.rich_text?.map(t => t.plain_text).join('') || ''
      const entr  = props['Entrega']?.date?.start?.split('T')[0] || ''
      // Diff em dias apenas com strings YYYY-MM-DD (sem bug de timezone)
      const dias = entr ? Math.round((new Date(hoje) - new Date(entr)) / 86400000) : 0
      return { tipos, resp, desc, cli, entrega: entr, atraso: dias }
    })

    // Busca grupos ativos com seus filtros
    const gruposRes = await query(
      `SELECT id, nome, chat_id, bom_dia, tipos_filtro_entrega FROM grupos_whatsapp WHERE ativo = true`
    )
    const grupos = gruposRes.rows
    const gruposPrincipal = grupos.filter(g => g.bom_dia)

    const msgsPorGrupo = {}
    const tarefasSemDestino = []

    for (const tarefa of parsed) {
      let gruposDestino = grupos.filter(g =>
        g.tipos_filtro_entrega?.length > 0 &&
        tarefa.tipos.some(t => g.tipos_filtro_entrega.includes(t))
      )
      if (gruposDestino.length === 0) gruposDestino = gruposPrincipal
      if (gruposDestino.length === 0) {
        tarefasSemDestino.push(tarefa.desc)
        continue
      }
      for (const g of gruposDestino) {
        if (!msgsPorGrupo[g.id]) msgsPorGrupo[g.id] = { grupo: g, tarefas: [] }
        msgsPorGrupo[g.id].tarefas.push(tarefa)
      }
    }

    const agora = new Date().toISOString()
    let totalInseridas = 0

    for (const { grupo, tarefas: lista } of Object.values(msgsPorGrupo)) {
      const linhas = lista.map(t => {
        const atraso = t.atraso > 0 ? ` _(${t.atraso}d atraso)_` : ''
        const cli = t.cli ? ` | ${t.cli}` : ''
        const resp = t.resp ? ` → ${t.resp}` : ''
        const tipos = t.tipos.length ? ` [${t.tipos.join('/')}]` : ''
        return `• *${t.desc}*${cli}${tipos}${resp}${atraso}`
      }).join('\n')

      const mensagem = `⚠️ *Tarefas vencidas — ${new Date().toLocaleDateString('pt-BR')}*\n\n${linhas}\n\n_Verificar e atualizar no Notion._`
      const dedupKey = `cobrar:${hoje}:${grupo.id}`

      // ON CONFLICT DO NOTHING garante idempotência — cron rodando 2x no mesmo dia não duplica
      const r = await query(
        `INSERT INTO mensagens_agendadas (grupo_id, mensagem, agendar_para, criado_por, status, dedup_key)
         VALUES ($1, $2, $3, 'sistema', 'pendente', $4)
         ON CONFLICT (dedup_key) DO NOTHING`,
        [grupo.id, mensagem, agora, dedupKey]
      )
      if (r.rowCount > 0) totalInseridas++
    }

    return NextResponse.json({
      ok: true,
      tarefas_vencidas: tarefas.length,
      grupos_notificados: totalInseridas,
      tarefas_sem_destino: tarefasSemDestino,
    })
  } catch (e) {
    console.error('[tarefas/cobrar]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
