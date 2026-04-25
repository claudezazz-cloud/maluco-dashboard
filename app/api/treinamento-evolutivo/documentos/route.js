import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'
import { ensureTables } from '@/lib/evolutivo/indexer'

export async function GET(req) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  await ensureTables()

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = 50
  const offset = (page - 1) * limit

  const [docs, total] = await Promise.all([
    query(
      `SELECT d.id, d.caminho, d.titulo, d.bytes, d.erro, d.atualizado_em,
              COUNT(c.id)::int AS chunks
       FROM evolutive_documents d
       LEFT JOIN evolutive_chunks c ON c.document_id = d.id
       WHERE d.ativo = true
       GROUP BY d.id
       ORDER BY d.atualizado_em DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    query('SELECT COUNT(*) as total FROM evolutive_documents WHERE ativo = true'),
  ])

  return NextResponse.json({
    documentos: docs.rows,
    total: parseInt(total.rows[0]?.total || 0),
    page,
    pages: Math.ceil(parseInt(total.rows[0]?.total || 0) / limit),
  })
}
