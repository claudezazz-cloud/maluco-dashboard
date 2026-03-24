import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getWorkflows } from '@/lib/n8n'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    const data = await getWorkflows()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
