import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

// GET /api/carnes/video?f=carne_<cod>_<ts>.mp4 — serve o vídeo da geração do carnê
// pro player da página /clientes. Sessão obrigatória. Nome de arquivo validado por
// regex estrita (sem / nem .., só o padrão carne_*.mp4) — anti path-traversal.
const VIDEO_DIR = process.env.RB_VIDEO_DIR || '/opt/zazz/dashboard/tools/gerar_carne/videos'
const SAFE = /^carne_[A-Za-z0-9]+_[0-9T\-]+\.mp4$/

export async function GET(req) {
  const session = await getSession()
  if (!session) return new Response(JSON.stringify({ error: 'Sem permissão' }), { status: 403 })

  const { searchParams } = new URL(req.url)
  const f = searchParams.get('f') || ''
  if (!SAFE.test(f)) return new Response(JSON.stringify({ error: 'Nome inválido' }), { status: 400 })

  const filePath = path.join(VIDEO_DIR, f)
  let stat
  try { stat = fs.statSync(filePath) } catch { return new Response(JSON.stringify({ error: 'Vídeo não encontrado' }), { status: 404 }) }

  const range = req.headers.get('range')
  const total = stat.size

  // Range (player pede pedaços pra seek) — resposta 206 parcial
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/)
    let start = m && m[1] ? parseInt(m[1], 10) : 0
    let end = m && m[2] ? parseInt(m[2], 10) : total - 1
    if (isNaN(start) || start < 0) start = 0
    if (isNaN(end) || end >= total) end = total - 1
    if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } })
    const chunk = fs.createReadStream(filePath, { start, end })
    return new Response(webStream(chunk), {
      status: 206,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  }

  return new Response(webStream(fs.createReadStream(filePath)), {
    status: 200,
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(total),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

// Node stream -> Web ReadableStream (formato que o Response do App Router aceita)
function webStream(nodeStream) {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk)))
      nodeStream.on('end', () => controller.close())
      nodeStream.on('error', (err) => controller.error(err))
    },
    cancel() { nodeStream.destroy() },
  })
}
