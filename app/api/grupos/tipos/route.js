import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026'

// GET /api/grupos/tipos?chatId=...
// Retorna tipos_filtro_entrega do grupo para o agent_loop filtrar listar_tarefas_notion
export async function GET(req) {
  const tok = req.headers.get('x-token')
  if (tok !== TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const chatId = new URL(req.url).searchParams.get('chatId') || ''
  if (!chatId) return NextResponse.json({ tipos: [] })

  const r = await query(
    'SELECT tipos_filtro_entrega FROM grupos_whatsapp WHERE chat_id = $1 LIMIT 1',
    [chatId]
  )
  const tipos = r.rows[0]?.tipos_filtro_entrega || []
  return NextResponse.json({ tipos })
}
