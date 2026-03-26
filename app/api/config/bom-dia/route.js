import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'
import { getRedis } from '@/lib/redis'

const DEFAULT_GRUPO = '554384924456-1616013394@g.us'
const REDIS_KEY = 'config:bom_dia_grupo'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS dashboard_config (
      id SERIAL PRIMARY KEY,
      chave VARCHAR(255) UNIQUE NOT NULL,
      valor TEXT,
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `)
}

export async function GET() {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
  }

  try {
    await ensureTable()
    const result = await query("SELECT valor FROM dashboard_config WHERE chave = 'bom_dia_grupo'")
    const grupo = result.rows[0]?.valor || DEFAULT_GRUPO
    return NextResponse.json({ grupo })
  } catch (e) {
    console.error('GET /api/config/bom-dia:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
  }

  try {
    const { grupo } = await req.json()
    if (!grupo || typeof grupo !== 'string' || grupo.trim().length < 5) {
      return NextResponse.json({ error: 'ID do grupo invalido' }, { status: 400 })
    }

    const valor = grupo.trim()

    await ensureTable()
    await query(
      `INSERT INTO dashboard_config (chave, valor, atualizado_em)
       VALUES ('bom_dia_grupo', $1, NOW())
       ON CONFLICT (chave) DO UPDATE SET valor = $1, atualizado_em = NOW()`,
      [valor]
    )

    // Salva tambem no Redis para o N8N ler
    try {
      const redis = getRedis()
      await redis.set(REDIS_KEY, valor)
    } catch (redisErr) {
      console.error('Redis set bom_dia_grupo falhou:', redisErr.message)
      // Nao falha a request - Postgres ja salvou
    }

    return NextResponse.json({ ok: true, grupo: valor })
  } catch (e) {
    console.error('PUT /api/config/bom-dia:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
