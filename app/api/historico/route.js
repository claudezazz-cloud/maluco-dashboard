import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { getRedis } from '@/lib/redis'

// DELETE - Limpar todo o histórico de conversas do Redis
export async function DELETE(req) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
  }

  try {
    const redis = getRedis()
    // Busca todas as chaves conv:*
    const keys = await redis.keys('conv:*')

    if (keys.length === 0) {
      return NextResponse.json({ ok: true, removidas: 0, mensagem: 'Nenhum historico encontrado' })
    }

    // Remove todas de uma vez
    await redis.del(...keys)

    return NextResponse.json({
      ok: true,
      removidas: keys.length,
      mensagem: `${keys.length} conversas removidas do historico`
    })
  } catch (e) {
    console.error('DELETE /api/historico:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET - Status do histórico
export async function GET() {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
  }

  try {
    const redis = getRedis()
    const keys = await redis.keys('conv:*')

    return NextResponse.json({
      total_conversas: keys.length,
      chaves: keys.slice(0, 20).map(k => k.replace('conv:', '')),
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
