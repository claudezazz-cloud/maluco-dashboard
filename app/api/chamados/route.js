import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getRedis } from '@/lib/redis'
import { processarChamados, REDIS_KEY } from './_processor'

export async function POST(req) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })

  try {
    const { chamados: rawRows, headers: rawHeaders } = await req.json()
    const result = await processarChamados({ rawRows, rawHeaders })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result)
  } catch (e) {
    console.error('POST /api/chamados:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })

  try {
    const redis = getRedis()
    const data = await redis.get(REDIS_KEY)
    if (!data) return NextResponse.json({ ativo: false, total: 0 })
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

export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })

  try {
    const redis = getRedis()
    await redis.del(REDIS_KEY)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
