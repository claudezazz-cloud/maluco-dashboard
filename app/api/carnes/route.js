import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

// GET /api/carnes — lista os carnês gerados pelo bot (fila_jobs tipo='carne'),
// com nome/código do cliente, meses, status e o vídeo da geração (quando existe).
// Usado pela página /clientes (seção "Carnês gerados").
const VIDEO_DIR = process.env.RB_VIDEO_DIR || '/opt/zazz/dashboard/tools/gerar_carne/videos'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    const r = await query(
      `SELECT id, payload, status, resultado, to_char(criado_em AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') AS criado
       FROM fila_jobs
       WHERE tipo = 'carne'
       ORDER BY id DESC
       LIMIT 200`
    )

    // arquivos disponíveis no diretório de vídeos (pra casar por código quando o
    // resultado não gravou o caminho — jobs antigos)
    let files = []
    try { files = fs.readdirSync(VIDEO_DIR).filter(f => f.endsWith('.mp4')) } catch {}

    const carnes = r.rows.map(row => {
      const p = row.payload || {}
      let res = {}
      try { res = typeof row.resultado === 'string' ? JSON.parse(row.resultado) : (row.resultado || {}) } catch {}

      // vídeo: 1) caminho gravado no resultado; 2) fallback: arquivo com o código do cliente
      let video = null
      const fromRes = res.video ? path.basename(String(res.video)) : null
      if (fromRes && files.includes(fromRes)) video = fromRes
      if (!video && p.cliente) {
        const doCod = files.filter(f => f.startsWith(`carne_${p.cliente}_`)).sort()
        if (doCod.length) video = doCod[doCod.length - 1] // mais recente do código
      }

      return {
        id: row.id,
        nome: p.nome || '',
        cliente: p.cliente || '',
        meses: Array.isArray(p.meses) ? p.meses : [],
        status: row.status,
        criado: row.criado,
        mensagem: res.mensagem || '',
        video, // filename ou null (vídeos antigos podem ter sido limpos do disco)
      }
    })

    return NextResponse.json({ carnes, total: carnes.length })
  } catch (e) {
    console.error('GET /api/carnes:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
