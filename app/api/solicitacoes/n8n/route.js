import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'

function checkToken(request) {
  const token = request.headers.get('x-token')
  return token === process.env.N8N_POPS_TOKEN
}

export async function GET(request) {
  if (!checkToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Hora atual no Brasil (UTC-3)
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const horaAtual = now.toTimeString().slice(0, 5) // "17:00"
  const diasMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
  const diaAtual = diasMap[now.getDay()]

  try {
    const result = await query(
      `SELECT * FROM dashboard_solicitacoes_programadas
       WHERE ativo = true
         AND hora = $1
         AND (dias_semana = 'todos' OR dias_semana LIKE '%' || $2 || '%')
         AND (ultimo_executado IS NULL
              OR ultimo_executado < NOW() - INTERVAL '50 minutes')
       ORDER BY id ASC`,
      [horaAtual, diaAtual]
    )
    return NextResponse.json({ tasks: result.rows })
  } catch (e) {
    return NextResponse.json({ tasks: [] })
  }
}

export async function POST(request) {
  if (!checkToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id } = body

  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  await query(
    'UPDATE dashboard_solicitacoes_programadas SET ultimo_executado = NOW() WHERE id = $1',
    [id]
  )
  return NextResponse.json({ ok: true })
}
