import { NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'

const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026'
const REDIS_KEY = 'chamados:data'

// GET /api/chamados/buscar
// Chamado pelo agent loop como tool buscar_chamados.
// Retorna o ai_context dos chamados importados (Redis TTL 24h).
export async function GET(req) {
  const tok = req.headers.get('x-token')
  if (tok !== TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const redis = getRedis()
    const data = await redis.get(REDIS_KEY)
    if (!data) {
      return NextResponse.json({ found: false, mensagem: 'Nenhum chamado importado no momento.' })
    }
    const parsed = JSON.parse(data)
    const ai_context = (parsed.ai_context || '').substring(0, 10000)
    if (!ai_context) {
      return NextResponse.json({ found: false, mensagem: 'Dados de chamados sem conteúdo para IA.' })
    }
    return NextResponse.json({
      found: true,
      importado_em: parsed.importado_em || null,
      total: parsed.total || 0,
      ai_context
    })
  } catch (e) {
    console.error('[chamados/buscar] erro:', e.message)
    return NextResponse.json({ found: false, mensagem: 'Erro ao buscar chamados: ' + e.message }, { status: 500 })
  }
}
