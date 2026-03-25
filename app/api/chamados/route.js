import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { getRedis } from '@/lib/redis'

const REDIS_KEY = 'chamados:data'
const TTL = 86400 // 24 horas

// Mapeamento de colunas da planilha para campos limpos
const COLUMN_MAP = {
  'numer': 'numero',
  'numero': 'numero',
  'protocolo': 'protocolo',
  'pric': 'prioridade',
  'prioridade': 'prioridade',
  'data ab': 'data_abertura',
  'data abertura': 'data_abertura',
  'hora ab': 'hora_abertura',
  'hora abertura': 'hora_abertura',
  'agendamento': 'agendamento',
  'iniciativa': 'iniciativa',
  'modo': 'modo',
  'cod. cliente/mercado': 'cod_cliente',
  'cod cliente': 'cod_cliente',
  'código cliente': 'cod_cliente',
  'cliente': 'cliente',
  'grupo': 'grupo',
  'distrito': 'distrito',
  'cidade': 'cidade',
  'l': 'uf',
  'uf': 'uf',
  'bairro': 'bairro',
  'endereco': 'endereco',
  'endereço': 'endereco',
  'end nux - complemento': 'complemento',
  'complemento': 'complemento',
  'tipo': 'tipo',
  'topico': 'topico',
  'tópico': 'topico',
  'fluxo': 'fluxo',
  'usuario abe': 'usuario',
  'usuário abe': 'usuario',
  'usuario': 'usuario',
  'grupo os': 'grupo_os',
  'sit oh atualizacao': 'sit_atualizacao',
  'sit oh atualização': 'sit_atualizacao',
  'tempo restante': 'tempo_restante',
  'situacao os': 'situacao',
  'situação os': 'situacao',
  'situacao': 'situacao',
  'situação': 'situacao',
}

function normalizeHeader(h) {
  return (h || '').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function mapColumns(headers) {
  return headers.map(h => {
    const norm = normalizeHeader(h)
    return COLUMN_MAP[norm] || norm.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  })
}

function buildSummary(chamados) {
  const total = chamados.length
  if (!total) return 'Nenhum chamado importado.'

  // Contagem por cidade
  const porCidade = {}
  const porTipo = {}
  const porSituacao = {}
  const porBairro = {}

  for (const c of chamados) {
    const cidade = c.cidade || 'Não informado'
    const tipo = c.tipo || 'Não informado'
    const sit = c.situacao || c.sit_atualizacao || 'Não informado'
    const bairro = c.bairro || 'Não informado'

    porCidade[cidade] = (porCidade[cidade] || 0) + 1
    porTipo[tipo] = (porTipo[tipo] || 0) + 1
    porSituacao[sit] = (porSituacao[sit] || 0) + 1
    porBairro[bairro] = (porBairro[bairro] || 0) + 1
  }

  const sortDesc = obj => Object.entries(obj).sort((a, b) => b[1] - a[1])

  let resumo = `Total: ${total} chamados\n`
  resumo += `Por cidade: ${sortDesc(porCidade).map(([k, v]) => `${k} (${v})`).join(', ')}\n`
  resumo += `Por tipo: ${sortDesc(porTipo).map(([k, v]) => `${k} (${v})`).join(', ')}\n`
  resumo += `Por situacao: ${sortDesc(porSituacao).map(([k, v]) => `${k} (${v})`).join(', ')}\n`
  resumo += `Por bairro (top 10): ${sortDesc(porBairro).slice(0, 10).map(([k, v]) => `${k} (${v})`).join(', ')}`

  return resumo
}

function buildAIContext(chamados, importadoEm) {
  const resumo = buildSummary(chamados)

  // Formato compacto: 1 linha por chamado
  const linhas = chamados.slice(0, 300).map(c => {
    const parts = [
      c.numero ? `#${c.numero}` : '',
      c.cliente ? `${c.cliente}${c.cod_cliente ? ' (' + c.cod_cliente + ')' : ''}` : '',
      [c.cidade, c.bairro].filter(Boolean).join(', '),
      [c.tipo, c.topico].filter(Boolean).join(' - '),
      c.situacao || c.sit_atualizacao || '',
      c.data_abertura ? `Aberto: ${c.data_abertura}` : '',
      c.agendamento ? `Agendado: ${c.agendamento}` : '',
      c.endereco ? `End: ${c.endereco}${c.complemento ? ', ' + c.complemento : ''}` : '',
      c.tempo_restante ? `Tempo: ${c.tempo_restante}` : '',
    ].filter(Boolean)
    return parts.join(' | ')
  })

  let ctx = `CHAMADOS ABERTOS (importados em ${importadoEm}):\n`
  ctx += resumo + '\n\n'
  ctx += 'Detalhes dos chamados:\n'
  ctx += linhas.join('\n')

  if (chamados.length > 300) {
    ctx += `\n... e mais ${chamados.length - 300} chamados (mostrando os 300 primeiros)`
  }

  return ctx
}

// POST - Importar chamados (recebe JSON parseado do client)
export async function POST(req) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
  }

  try {
    const { chamados: rawRows, headers: rawHeaders } = await req.json()
    if (!rawRows || !Array.isArray(rawRows) || !rawRows.length) {
      return NextResponse.json({ error: 'Nenhum dado encontrado na planilha' }, { status: 400 })
    }

    // Mapear colunas
    const mappedHeaders = rawHeaders ? mapColumns(rawHeaders) : null

    // Converter rows para objetos com campos mapeados
    const chamados = rawRows.map(row => {
      if (mappedHeaders && Array.isArray(row)) {
        const obj = {}
        mappedHeaders.forEach((key, i) => {
          if (key && row[i] !== undefined && row[i] !== null && row[i] !== '') {
            obj[key] = String(row[i]).trim()
          }
        })
        return obj
      }
      // Se ja veio como objeto, mapear as chaves
      const obj = {}
      for (const [key, val] of Object.entries(row)) {
        const norm = normalizeHeader(key)
        const mapped = COLUMN_MAP[norm] || norm.replace(/[^a-z0-9]/g, '_')
        if (val !== undefined && val !== null && val !== '') {
          obj[mapped] = String(val).trim()
        }
      }
      return obj
    }).filter(c => Object.keys(c).length > 0)

    if (!chamados.length) {
      return NextResponse.json({ error: 'Nenhum chamado valido encontrado' }, { status: 400 })
    }

    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const aiContext = buildAIContext(chamados, agora)

    const payload = {
      importado_em: agora,
      total: chamados.length,
      resumo: buildSummary(chamados),
      ai_context: aiContext,
      chamados,
    }

    const redis = getRedis()
    await redis.set(REDIS_KEY, JSON.stringify(payload), 'EX', TTL)

    return NextResponse.json({
      ok: true,
      total: chamados.length,
      resumo: payload.resumo,
      importado_em: agora,
      expira_em: new Date(Date.now() + TTL * 1000).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    })
  } catch (e) {
    console.error('POST /api/chamados:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET - Status atual dos chamados
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })

  try {
    const redis = getRedis()
    const data = await redis.get(REDIS_KEY)
    if (!data) {
      return NextResponse.json({ ativo: false, total: 0 })
    }
    const parsed = JSON.parse(data)
    const ttl = await redis.ttl(REDIS_KEY)
    return NextResponse.json({
      ativo: true,
      total: parsed.total,
      resumo: parsed.resumo,
      importado_em: parsed.importado_em,
      expira_em_segundos: ttl,
      expira_em: new Date(Date.now() + ttl * 1000).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    })
  } catch (e) {
    console.error('GET /api/chamados:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE - Limpar chamados do Redis
export async function DELETE() {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
  }

  try {
    const redis = getRedis()
    await redis.del(REDIS_KEY)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
