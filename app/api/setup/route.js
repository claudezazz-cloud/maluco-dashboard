import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'

// Rota de setup inicial - cria tabelas e usuário admin
// Acesse /api/setup uma vez após o deploy
export async function GET() {
  try {
    // Criar tabelas
    await query(`
      CREATE TABLE IF NOT EXISTS dashboard_usuarios (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha_hash VARCHAR(255) NOT NULL,
        nome VARCHAR(255),
        role VARCHAR(50) DEFAULT 'colaborador',
        ativo BOOLEAN DEFAULT true,
        criado_em TIMESTAMP DEFAULT NOW()
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS dashboard_filiais (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        n8n_workflow_id VARCHAR(255),
        evolution_instance VARCHAR(255),
        group_chat_id VARCHAR(255),
        ativo BOOLEAN DEFAULT true,
        criado_em TIMESTAMP DEFAULT NOW()
      )
    `)

    // Inserir filial padrão (Lunardelli)
    await query(`
      INSERT INTO dashboard_filiais (nome, n8n_workflow_id, evolution_instance, group_chat_id)
      VALUES ('Lunardelli', 'BhIJ7UrKM9uWhXHa', 'ZazzClaude', '120363409735124488@g.us')
      ON CONFLICT DO NOTHING
    `)

    // Criar usuário admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@empresa.com.br'
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123'
    const hash = await bcrypt.hash(adminPass, 10)

    const existing = await query('SELECT id FROM dashboard_usuarios WHERE email = $1', [adminEmail])
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO dashboard_usuarios (email, senha_hash, nome, role) VALUES ($1, $2, $3, 'admin')`,
        [adminEmail, hash, 'Administrador']
      )
    }

    return NextResponse.json({
      ok: true,
      mensagem: 'Setup concluído!',
      admin: adminEmail,
      aviso: 'Delete ou proteja esta rota após o setup!'
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e.message) }, { status: 500 })
  }
}
