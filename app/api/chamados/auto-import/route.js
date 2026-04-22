import { NextResponse } from 'next/server'
import { processarChamados } from '../_processor'

export async function POST(req) {
  const token = req.headers.get('x-auto-token')
  if (token !== (process.env.CHAMADOS_AUTO_TOKEN || 'CHAMADOS_AUTO_2026')) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { chamados: rawRows, headers: rawHeaders } = await req.json()
    const result = await processarChamados({ rawRows, rawHeaders })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({
      ok: true,
      total: result.total,
      importado_em: result.importado_em,
      expira_em: result.expira_em,
    })
  } catch (e) {
    console.error('POST /api/chamados/auto-import:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
