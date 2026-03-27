import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { getRedis } from '@/lib/redis'

const REDIS_KEY = 'clientes:data'

const COLUMN_MAP = {
  'cod': 'cod',
  'cod.': 'cod',
  'codigo': 'cod',
  'código': 'cod',
  'code': 'cod',
  'cod. cliente/mercado': 'cod',
  'cod cliente': 'cod',
  'cod_cliente': 'cod',
  'codigo cliente': 'cod',
  'id': 'cod',
  'nome': 'nome',
  'name': 'nome',
  'cliente': 'nome',
  'razao social': 'nome',
  'razão social': 'nome',
  'nome cliente': 'nome',
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

// POST - Importar clientes
export async function POST(req) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
  }

  try {
    const { clientes: rawRows, headers: rawHeaders } = await req.json()
    if (!rawRows || !Array.isArray(rawRows) || !rawRows.length) {
      return NextResponse.json({ error: 'Nenhum dado encontrado na planilha' }, { status: 400 })
    }

    const mappedHeaders = rawHeaders ? mapColumns(rawHeaders) : null

    // Converter rows para objetos { cod, nome }
    const clientes = rawRows.map(row => {
      if (mappedHeaders && Array.isArray(row)) {
        const obj = {}
        mappedHeaders.forEach((key, i) => {
          if (key && row[i] !== undefined && row[i] !== null && row[i] !== '') {
            obj[key] = String(row[i]).trim()
          }
        })
        return obj
      }
      const obj = {}
      for (const [key, val] of Object.entries(row)) {
        const norm = normalizeHeader(key)
        const mapped = COLUMN_MAP[norm] || norm
        if (val !== undefined && val !== null && val !== '') {
          obj[mapped] = String(val).trim()
        }
      }
      return obj
    }).filter(c => c.cod && c.nome)

    if (!clientes.length) {
      return NextResponse.json({ error: 'Nenhum cliente valido encontrado. Verifique se a planilha tem colunas Cod e Nome.' }, { status: 400 })
    }

    // Gera texto no formato que o Monta Prompt ja parseia (tab-separated)
    const textoBot = clientes.map(c => `${c.nome}\t${c.cod}`).join('\n')

    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

    const payload = {
      importado_em: agora,
      total: clientes.length,
      clientes,
      texto_bot: textoBot,
    }

    const redis = getRedis()
    // Sem TTL - clientes ficam ate serem removidos ou substituidos
    await redis.set(REDIS_KEY, JSON.stringify(payload))

    return NextResponse.json({
      ok: true,
      total: clientes.length,
      importado_em: agora,
      debug_headers: mappedHeaders,
      debug_primeiros: clientes.slice(0, 5),
    })
  } catch (e) {
    console.error('POST /api/clientes:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET - Status atual dos clientes
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
    return NextResponse.json({
      ativo: true,
      total: parsed.total,
      importado_em: parsed.importado_em,
    })
  } catch (e) {
    console.error('GET /api/clientes:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE - Limpar clientes do Redis
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
