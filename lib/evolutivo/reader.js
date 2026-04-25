import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const MAX_FILE_BYTES = 500 * 1024 // 500 KB
const PROJECT_ROOT = process.cwd()

// Whitelist: resolved paths allowed. Defaults to project root.
function getWhitelist() {
  const raw = process.env.EVOLUTIVO_ROOT_WHITELIST || PROJECT_ROOT
  return raw.split(';').map(p => path.resolve(p.trim())).filter(Boolean)
}

// Validate that the given folder is inside the whitelist
export function validarPath(pasta) {
  const abs = path.resolve(PROJECT_ROOT, pasta)
  const whitelist = getWhitelist()
  const allowed = whitelist.some(w => abs === w || abs.startsWith(w + path.sep))
  if (!allowed) {
    return { ok: false, erro: `Path '${abs}' fora da whitelist permitida.` }
  }
  return { ok: true, abs }
}

// Extract title from frontmatter or filename
function extrairTitulo(conteudo, caminhoRel) {
  const fm = conteudo.match(/^---\n([\s\S]*?)\n---\n/)
  if (fm) {
    const m = fm[1].match(/^title:\s*(.+)$/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return path.basename(caminhoRel, '.md')
}

// Recursively list .md files, excluding ignored dirs/files
async function listarArquivos(dir, ignorarArr, baseDir, resultados = []) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return resultados
  }

  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!ignorarArr.includes(entry.name)) {
        await listarArquivos(abs, ignorarArr, baseDir, resultados)
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      resultados.push({ abs, rel: path.relative(baseDir, abs) })
    }
  }
  return resultados
}

// Read all markdown notes in a folder, returning structured objects
export async function lerNotas(pastaAbs, ignorarStr = '') {
  const ignorarArr = ignorarStr
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const arquivos = await listarArquivos(pastaAbs, ignorarArr, pastaAbs)
  const notas = []
  const erros = []

  for (const { abs, rel } of arquivos) {
    try {
      const stat = await fs.stat(abs)
      if (stat.size > MAX_FILE_BYTES) {
        erros.push({ caminho: rel, erro: `Arquivo muito grande (${Math.round(stat.size / 1024)}KB > 500KB)` })
        continue
      }
      const conteudo = await fs.readFile(abs, 'utf-8')
      const hash = crypto.createHash('sha256').update(conteudo).digest('hex')
      const titulo = extrairTitulo(conteudo, rel)
      notas.push({
        caminhoRel: rel,
        titulo,
        conteudo,
        hash,
        mtime: stat.mtime,
        bytes: stat.size,
      })
    } catch (e) {
      erros.push({ caminho: rel, erro: e.message })
    }
  }

  return { notas, erros }
}
