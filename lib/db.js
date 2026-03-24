import { Pool } from 'pg'

// Usa PG_URL para evitar conflito com o DATABASE_URL interno do Railway
const pool = new Pool({
  connectionString: process.env.PG_URL,
  max: 10,
  ssl: false,
})

export async function query(text, params) {
  const client = await pool.connect()
  try {
    return await client.query(text, params)
  } finally {
    client.release()
  }
}
