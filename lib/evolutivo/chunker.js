const MAX_CHARS = 1500
const OVERLAP = 150

// Remove YAML frontmatter from markdown
function removeFrontmatter(texto) {
  return texto.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
}

// Strip Obsidian wikilinks [[X]] → X, [[X|alias]] → alias
function limparWikilinks(texto) {
  return texto
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
}

// Split text into chunks preserving ## headers context
export function chunk(texto, opts = {}) {
  const maxChars = opts.maxChars || MAX_CHARS
  const overlap = opts.overlap || OVERLAP

  const limpo = limparWikilinks(removeFrontmatter(texto))

  // Split into paragraphs (double newline or heading)
  const blocos = limpo
    .split(/\n{2,}/)
    .map(b => b.trim())
    .filter(b => b.length > 0)

  const chunks = []
  let atual = ''
  let headerAtual = ''

  for (const bloco of blocos) {
    // Track current section header for context injection
    if (/^#{1,3}\s/.test(bloco)) {
      headerAtual = bloco
    }

    const candidato = atual ? atual + '\n\n' + bloco : bloco

    if (candidato.length <= maxChars) {
      atual = candidato
    } else {
      // Flush current chunk
      if (atual) {
        chunks.push(atual.trim())
        // Overlap: keep last N chars of current as start of next
        const overlapText = atual.slice(-overlap).trim()
        atual = (headerAtual && !overlapText.startsWith('#') ? headerAtual + '\n\n' : '') + overlapText + '\n\n' + bloco
      } else {
        // Single block bigger than maxChars — hard split
        for (let i = 0; i < bloco.length; i += maxChars - overlap) {
          chunks.push(bloco.slice(i, i + maxChars).trim())
        }
        atual = ''
      }
    }
  }

  if (atual.trim()) chunks.push(atual.trim())

  return chunks.map((conteudo, ordem) => ({
    ordem,
    conteudo,
    tamanho: conteudo.length,
  }))
}
