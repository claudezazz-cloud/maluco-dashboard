import { query } from '@/lib/db'
import { validarPath, lerNotas } from './reader.js'
import { chunk } from './chunker.js'

export async function ensureTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS evolutive_sources (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      pasta TEXT NOT NULL,
      ignorar TEXT DEFAULT '.obsidian,templates,lixeira,trash',
      ativo BOOLEAN DEFAULT true,
      ultima_sync TIMESTAMP,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS evolutive_documents (
      id SERIAL PRIMARY KEY,
      source_id INT REFERENCES evolutive_sources(id) ON DELETE CASCADE,
      caminho TEXT NOT NULL,
      titulo VARCHAR(500),
      hash VARCHAR(64) NOT NULL,
      mtime TIMESTAMP,
      bytes INT,
      erro TEXT,
      ativo BOOLEAN DEFAULT true,
      atualizado_em TIMESTAMP DEFAULT NOW(),
      UNIQUE(source_id, caminho)
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS evolutive_chunks (
      id SERIAL PRIMARY KEY,
      document_id INT REFERENCES evolutive_documents(id) ON DELETE CASCADE,
      ordem INT NOT NULL,
      conteudo TEXT NOT NULL,
      tamanho INT,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_evolutive_chunks_doc ON evolutive_chunks(document_id)`)

  await query(`
    CREATE TABLE IF NOT EXISTS evolutive_sync_logs (
      id SERIAL PRIMARY KEY,
      source_id INT REFERENCES evolutive_sources(id) ON DELETE CASCADE,
      iniciado_em TIMESTAMP DEFAULT NOW(),
      finalizado_em TIMESTAMP,
      arquivos_lidos INT DEFAULT 0,
      arquivos_atualizados INT DEFAULT 0,
      arquivos_pulados INT DEFAULT 0,
      erros INT DEFAULT 0,
      detalhes TEXT
    )
  `)
}

export async function sincronizar(sourceId) {
  await ensureTables()

  // Fetch source config
  const srcRes = await query('SELECT * FROM evolutive_sources WHERE id = $1', [sourceId])
  if (!srcRes.rows[0]) throw new Error('Fonte não encontrada: ' + sourceId)
  const source = srcRes.rows[0]

  // Create sync log entry
  const logRes = await query(
    'INSERT INTO evolutive_sync_logs (source_id) VALUES ($1) RETURNING id',
    [sourceId]
  )
  const logId = logRes.rows[0].id

  const resultado = { lidos: 0, atualizados: 0, pulados: 0, erros: 0, detalhes: [] }

  try {
    const vp = validarPath(source.pasta)
    if (!vp.ok) throw new Error(vp.erro)

    const { notas, erros: errosLeitura } = await lerNotas(vp.abs, source.ignorar || '')

    // Mark reading errors
    for (const e of errosLeitura) {
      resultado.erros++
      resultado.detalhes.push({ caminho: e.caminho, erro: e.erro })
      await query(
        `INSERT INTO evolutive_documents (source_id, caminho, hash, titulo, erro, ativo)
         VALUES ($1, $2, 'erro', $3, $4, false)
         ON CONFLICT (source_id, caminho) DO UPDATE SET erro = EXCLUDED.erro, ativo = false, atualizado_em = NOW()`,
        [sourceId, e.caminho, e.caminho, e.erro]
      )
    }

    resultado.lidos = notas.length

    // Get existing docs hashes for dedup
    const existRes = await query(
      'SELECT caminho, hash FROM evolutive_documents WHERE source_id = $1 AND ativo = true',
      [sourceId]
    )
    const hashMap = new Map(existRes.rows.map(r => [r.caminho, r.hash]))

    for (const nota of notas) {
      try {
        const existHash = hashMap.get(nota.caminhoRel)

        if (existHash === nota.hash) {
          // No change — skip reindexing
          resultado.pulados++
          continue
        }

        // Upsert document
        const docRes = await query(
          `INSERT INTO evolutive_documents (source_id, caminho, titulo, hash, mtime, bytes, erro, ativo, atualizado_em)
           VALUES ($1, $2, $3, $4, $5, $6, NULL, true, NOW())
           ON CONFLICT (source_id, caminho) DO UPDATE SET
             titulo = EXCLUDED.titulo, hash = EXCLUDED.hash, mtime = EXCLUDED.mtime,
             bytes = EXCLUDED.bytes, erro = NULL, ativo = true, atualizado_em = NOW()
           RETURNING id`,
          [sourceId, nota.caminhoRel, nota.titulo, nota.hash, nota.mtime, nota.bytes]
        )
        const docId = docRes.rows[0].id

        // Replace chunks
        await query('DELETE FROM evolutive_chunks WHERE document_id = $1', [docId])
        const chunks = chunk(nota.conteudo)
        for (const c of chunks) {
          await query(
            'INSERT INTO evolutive_chunks (document_id, ordem, conteudo, tamanho) VALUES ($1, $2, $3, $4)',
            [docId, c.ordem, c.conteudo, c.tamanho]
          )
        }

        resultado.atualizados++
      } catch (e) {
        resultado.erros++
        resultado.detalhes.push({ caminho: nota.caminhoRel, erro: e.message })
      }
    }

    // Update source ultima_sync
    await query('UPDATE evolutive_sources SET ultima_sync = NOW() WHERE id = $1', [sourceId])

  } finally {
    // Finalize log
    await query(
      `UPDATE evolutive_sync_logs SET
        finalizado_em = NOW(),
        arquivos_lidos = $2,
        arquivos_atualizados = $3,
        arquivos_pulados = $4,
        erros = $5,
        detalhes = $6
       WHERE id = $1`,
      [logId, resultado.lidos, resultado.atualizados, resultado.pulados, resultado.erros, JSON.stringify(resultado.detalhes)]
    )
  }

  return resultado
}
