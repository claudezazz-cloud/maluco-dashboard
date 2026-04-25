import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'
import { ensureTables } from '@/lib/evolutivo/indexer'

export async function GET() {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  await ensureTables()

  const [src, docs, chunks, logs] = await Promise.all([
    query('SELECT * FROM evolutive_sources ORDER BY id LIMIT 1'),
    query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE erro IS NOT NULL) as com_erro FROM evolutive_documents WHERE ativo = true'),
    query('SELECT COUNT(*) as total FROM evolutive_chunks c JOIN evolutive_documents d ON d.id = c.document_id WHERE d.ativo = true'),
    query('SELECT * FROM evolutive_sync_logs ORDER BY id DESC LIMIT 5'),
  ])

  return NextResponse.json({
    fonte: src.rows[0] || null,
    totalDocumentos: parseInt(docs.rows[0]?.total || 0),
    totalErros: parseInt(docs.rows[0]?.com_erro || 0),
    totalChunks: parseInt(chunks.rows[0]?.total || 0),
    ultimosLogs: logs.rows,
  })
}
