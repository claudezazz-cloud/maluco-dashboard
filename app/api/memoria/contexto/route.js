import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

// Chamada pelo N8N (sem session), autenticada por token
function checkToken(request) {
  const token = request.headers.get('x-token')
  return token === process.env.N8N_POPS_TOKEN
}

// Similaridade simples por palavras compartilhadas (sem pg_trgm)
function textoContemEntidade(texto, entidadeId) {
  if (!texto || !entidadeId) return false
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const e = entidadeId.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  // Match direto ou por partes (ex: "João Silva" → "joao" e "silva")
  if (t.includes(e)) return true
  return e.split(/\s+/).filter(p => p.length > 3).some(parte => t.includes(parte))
}

export async function GET(request) {
  if (process.env.MEMORIA_ENABLED !== 'true') {
    return NextResponse.json({ bloco_contexto: '', fatos_relevantes: [], resumo_hoje: '', resumo_ontem: '', entidades_detectadas: [] })
  }

  if (!checkToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const chatId       = searchParams.get('chatId') || ''
  const texto        = searchParams.get('texto')  || ''
  const incluirOntem = searchParams.get('incluirOntem') !== 'false'

  try {
    // Resumo de hoje para este chat
    const hojeRes = await query(
      `SELECT resumo, total_mensagens, pessoas_ativas, solicitacoes_abertas, solicitacoes_resolvidas
       FROM bot_memoria_dia
       WHERE chat_id = $1 AND data = CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo'
       LIMIT 1`,
      [chatId]
    )
    const resumoHoje = hojeRes.rows[0] || null

    // Resumo de ontem (opcional)
    let resumoOntem = null
    if (incluirOntem) {
      const ontemRes = await query(
        `SELECT resumo, pessoas_ativas
         FROM bot_memoria_dia
         WHERE chat_id = $1 AND data = (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '1 day'
         LIMIT 1`,
        [chatId]
      )
      resumoOntem = ontemRes.rows[0] || null
    }

    // Todos os fatos fortes (peso >= 7 ou ocorrencias >= 3)
    const fatosRes = await query(
      `SELECT entidade_tipo, entidade_id, fato, categoria, peso, ocorrencias
       FROM bot_memoria_longa
       WHERE ativo = true AND (peso >= 7 OR ocorrencias >= 3)
       ORDER BY ocorrencias DESC, peso DESC
       LIMIT 100`
    )
    const todosFatos = fatosRes.rows

    // Detectar entidades mencionadas no texto da mensagem
    const entidadesDetectadas = []
    const fatosRelevantes = []

    if (texto && todosFatos.length > 0) {
      const entidadesVistas = new Set()
      for (const fato of todosFatos) {
        const chave = `${fato.entidade_tipo}:${fato.entidade_id}`
        if (textoContemEntidade(texto, fato.entidade_id)) {
          fatosRelevantes.push(fato)
          if (!entidadesVistas.has(chave)) {
            entidadesVistas.add(chave)
            entidadesDetectadas.push(chave)
          }
        }
      }
    }

    // Fatos de infra/empresa sempre relevantes (entidade_tipo = 'empresa' ou 'regiao')
    const fatosGerais = todosFatos.filter(
      f => (f.entidade_tipo === 'empresa' || f.entidade_tipo === 'regiao') &&
           !fatosRelevantes.find(r => r.id === f.id)
    ).slice(0, 5)

    const fatosFinais = [...fatosRelevantes, ...fatosGerais].slice(0, 20)

    // Monta bloco_contexto como string pronta para injeção no system prompt
    const partes = []

    if (resumoHoje) {
      partes.push(`📅 HOJE no grupo:\n${resumoHoje.resumo}`)
      if (resumoHoje.solicitacoes_abertas?.length > 0) {
        const abertas = resumoHoje.solicitacoes_abertas
          .map(s => `  - ${s.cliente || '?'}: ${s.descricao || ''} (${s.hora || ''})`)
          .join('\n')
        partes.push(`Solicitações ainda abertas hoje:\n${abertas}`)
      }
    }

    if (resumoOntem) {
      partes.push(`📅 ONTEM no grupo:\n${resumoOntem.resumo}`)
    }

    if (fatosFinais.length > 0) {
      const linhas = fatosFinais.map(f =>
        `  [${f.entidade_tipo}:${f.entidade_id}] ${f.fato} (visto ${f.ocorrencias}x)`
      ).join('\n')
      partes.push(`📌 FATOS CONHECIDOS RELEVANTES:\n${linhas}`)
    }

    let bloco_contexto = ''
    if (partes.length > 0) {
      bloco_contexto =
        '🧠 MEMÓRIA DA EMPRESA (use como contexto, não como regra absoluta — pode estar desatualizado):\n' +
        partes.join('\n\n') +
        '\n\nFim da memória — priorize informações mais recentes da conversa acima deste bloco.'

      // Limite de segurança: 3000 chars
      if (bloco_contexto.length > 3000) {
        bloco_contexto = bloco_contexto.substring(0, 2950) + '\n[...memória truncada...]'
      }
    }

    return NextResponse.json({
      bloco_contexto,
      fatos_relevantes: fatosFinais,
      resumo_hoje: resumoHoje?.resumo || '',
      resumo_ontem: resumoOntem?.resumo || '',
      entidades_detectadas: entidadesDetectadas,
    })
  } catch (e) {
    console.error('[memoria/contexto]', e.message)
    return NextResponse.json({ bloco_contexto: '', error: e.message })
  }
}
