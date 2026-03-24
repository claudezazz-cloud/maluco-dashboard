import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
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

    await query(`
      CREATE TABLE IF NOT EXISTS dashboard_filiais_config (
        id SERIAL PRIMARY KEY,
        filial_id INTEGER REFERENCES dashboard_filiais(id) ON DELETE CASCADE,
        chave VARCHAR(255) NOT NULL,
        valor TEXT,
        UNIQUE(filial_id, chave)
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS dashboard_colaboradores (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        cargo VARCHAR(255),
        funcoes TEXT,
        ativo BOOLEAN DEFAULT true
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS dashboard_pops (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL,
        categoria VARCHAR(255) DEFAULT 'Geral',
        conteudo TEXT NOT NULL,
        ativo BOOLEAN DEFAULT true,
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS regras (
        id SERIAL PRIMARY KEY,
        regra TEXT NOT NULL
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS mensagens (
        id SERIAL PRIMARY KEY,
        message_id VARCHAR(255) UNIQUE,
        remetente VARCHAR(255),
        mensagem TEXT,
        chat_id VARCHAR(255),
        data_hora TIMESTAMP DEFAULT NOW()
      )
    `)

    // Admin padrão
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@maluco.ia'
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
    const existing = await query('SELECT id FROM dashboard_usuarios WHERE email = $1', [adminEmail])
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(adminPassword, 10)
      await query(
        'INSERT INTO dashboard_usuarios (email, senha_hash, nome, role) VALUES ($1, $2, $3, $4)',
        [adminEmail, hash, 'Administrador', 'admin']
      )
    }

    // Filial padrão Lunardelli
    const filialExist = await query("SELECT id FROM dashboard_filiais WHERE nome = 'Lunardelli'")
    if (filialExist.rows.length === 0) {
      await query(
        "INSERT INTO dashboard_filiais (nome, n8n_workflow_id, evolution_instance, group_chat_id) VALUES ('Lunardelli', 'BhIJ7UrKM9uWhXHa', 'ZazzClaude', '120363409735124488@g.us')"
      )
    }

    return NextResponse.json({ ok: true, message: 'Banco de dados configurado com sucesso!' })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
