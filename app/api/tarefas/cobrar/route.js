import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026'
const NOTION_TOKEN = process.env.NOTION_TOKEN
const NOTION_DB = 'd54e5911e8af43dfaed8f2893e59f6ef'

// POST /api/tarefas/cobrar
// Chamado via cron VPS às 08h15 seg-sáb.
// 1. Busca tarefas Parado com entrega <= hoje no Notion
// 2. Agrupa por tipo → resolve quais grupos recebem (tipos_filtro_entrega)
// 3. Cria mensagens_agendadas com agendar_para=NOW() para envio imediato
// 4. Grupos sem filtro de tipo: usa grupos com bom_dia=true (grupo principal)
export async function POST(req) {
  const tok = req.headers.get('x-token')
  if (tok !== TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    // 1. Busca tarefas Parado com entrega <= hoje no Notion
    const hoje = new Date().toISOString().split('T')[0]
    const notionRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          and: [
            { property: 'status', select: { equals: 'Parado' } },
            { property: 'Entrega', date: { on_or_before: hoje } }
          ]
        },
        sorts: [{ property: 'Entrega', direction: 'ascending' }],
        page_size: 100
      })
    })
    if (!notionRes.ok) {
      const err = await notionRes.text()
      return NextResponse.json({ error: `Notion error: ${err.substring(0, 200)}` }, { status: 502 })
    }
    const notionData = await notionRes.json()
    const tarefas = notionData.results || []

    if (tarefas.length === 0) {
      return NextResponse.json({ ok: true, msg: 'Nenhuma tarefa vencida encontrada.', enviadas: 0 })
    }

    // 2. Parseia cada tarefa
    const parsed = tarefas.map(p => {
      const props = p.properties || {}
      const tipos = (props['Tipo']?.multi_select || []).map(t => t.name)
      const resp  = (props['Responsável']?.people || []).map(pe => pe.name).join(', ')
      const desc  = props['Descrição']?.title?.map(t => t.plain_text).join('') || '(sem descrição)'
      const cli   = props['Cliente']?.rich_text?.map(t => t.plain_text).join('') || ''
      const entr  = props['Entrega']?.date?.start || ''
      const dias  = entr ? Math.floor((new Date() - new Date(entr)) / 86400000) : 0
      return { tipos, resp, desc, cli, entrega: entr, atraso: dias }
    })

    // 3. Busca grupos ativos com seus filtros
    const gruposRes = await query(
      `SELECT id, nome, chat_id, bom_dia, tipos_filtro_entrega
       FROM grupos_whatsapp WHERE ativo = true`
    )
    const grupos = gruposRes.rows
    const gruposPrincipal = grupos.filter(g => g.bom_dia)

    // 4. Para cada grupo, monta lista de tarefas que pertencem a ele
    const msgsPorGrupo = {}

    for (const tarefa of parsed) {
      // Determina quais grupos recebem essa tarefa
      let gruposDestino = grupos.filter(g =>
        g.tipos_filtro_entrega?.length > 0 &&
        tarefa.tipos.some(t => g.tipos_filtro_entrega.includes(t))
      )
      // Se nenhum filtro específico, vai pro grupo principal (bom_dia=true)
      if (gruposDestino.length === 0) gruposDestino = gruposPrincipal

      for (const g of gruposDestino) {
        if (!msgsPorGrupo[g.id]) msgsPorGrupo[g.id] = { grupo: g, tarefas: [] }
        msgsPorGrupo[g.id].tarefas.push(tarefa)
      }
    }

    // 5. Monta e insere mensagens_agendadas
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

      await query(
        `INSERT INTO mensagens_agendadas (grupo_id, mensagem, agendar_para, criado_por, status)
         VALUES ($1, $2, $3, 'sistema', 'pendente')`,
        [grupo.id, mensagem, agora]
      )
      totalInseridas++
    }

    return NextResponse.json({
      ok: true,
      tarefas_vencidas: tarefas.length,
      grupos_notificados: totalInseridas,
      enviadas: totalInseridas
    })
  } catch (e) {
    console.error('[tarefas/cobrar]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
