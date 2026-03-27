import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

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

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS dashboard_clientes (
      id SERIAL PRIMARY KEY,
      cod VARCHAR(50) NOT NULL,
      nome VARCHAR(500) NOT NULL,
      ativo BOOLEAN DEFAULT true,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS dashboard_config (
      id SERIAL PRIMARY KEY,
      chave VARCHAR(255) UNIQUE NOT NULL,
      valor TEXT,
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `)
}

// POST - Importar clientes (salva no Postgres)
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

    await ensureTable()

    // Limpa tabela antes de reimportar
    await query('DELETE FROM dashboard_clientes')

    // Bulk insert em batches de 100
    const BATCH_SIZE = 100
    for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
      const batch = clientes.slice(i, i + BATCH_SIZE)
      const values = []
      const params = []
      batch.forEach((c, idx) => {
        const offset = idx * 2
        values.push(`($${offset + 1}, $${offset + 2})`)
        params.push(c.cod, c.nome)
      })
      await query(
        `INSERT INTO dashboard_clientes (cod, nome) VALUES ${values.join(', ')}`,
        params
      )
    }

    // Salva timestamp de importacao
    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    await query(
      `INSERT INTO dashboard_config (chave, valor, atualizado_em)
       VALUES ('clientes_importado_em', $1, NOW())
       ON CONFLICT (chave) DO UPDATE SET valor = $1, atualizado_em = NOW()`,
      [agora]
    )

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
    await ensureTable()
    const countResult = await query('SELECT count(*)::int as total FROM dashboard_clientes WHERE ativo = true')
    const total = countResult.rows[0]?.total || 0

    if (total === 0) {
      return NextResponse.json({ ativo: false, total: 0 })
    }

    const tsResult = await query("SELECT valor FROM dashboard_config WHERE chave = 'clientes_importado_em'")
    const importado_em = tsResult.rows[0]?.valor || ''

    return NextResponse.json({
      ativo: true,
      total,
      importado_em,
    })
  } catch (e) {
    console.error('GET /api/clientes:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE - Limpar clientes
export async function DELETE() {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
  }

  try {
    await ensureTable()
    await query('DELETE FROM dashboard_clientes')
    await query("DELETE FROM dashboard_config WHERE chave = 'clientes_importado_em'")
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
