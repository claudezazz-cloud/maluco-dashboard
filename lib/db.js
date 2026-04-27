import { Pool } from 'pg'

// Usa PG_URL para evitar conflito com o DATABASE_URL interno do Railway
const pool = new Pool({
  connectionString: process.env.PG_URL,
  max: 10,
  ssl: false,
  connectionTimeoutMillis: 5000, // 5 segundos para falhar se não conectar
  idleTimeoutMillis: 30000,      // 30 segundos para fechar conexões inativas
})

export async function query(text, params) {
  let client
  try {
    client = await pool.connect()
    return await client.query(text, params)
  } catch (error) {
    console.error('Erro na query PostgreSQL:', {
      text,
      params,
      error: error.message
    })
    throw error
  } finally {
    if (client) client.release()
  }
}

export async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn((text, params) => client.query(text, params))
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
