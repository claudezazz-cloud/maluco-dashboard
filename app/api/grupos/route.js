import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS grupos_whatsapp (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      chat_id VARCHAR(255) UNIQUE NOT NULL DEFAULT '',
      descricao TEXT DEFAULT '',
      ativo BOOLEAN DEFAULT true,
      bom_dia BOOLEAN DEFAULT false,
      alertas_notion_entrega BOOLEAN DEFAULT false,
      alertas_notion_ok BOOLEAN DEFAULT false,
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `)
}

const GRUPOS_INICIAIS = [
  { nome: "Nego's Internet",    chat_id: '',  bom_dia: true,  alertas_notion_entrega: false, alertas_notion_ok: true,  descricao: 'Grupo principal de atendimento' },
  { nome: "Nego's Sub",         chat_id: '',  bom_dia: false, alertas_notion_entrega: true,  alertas_notion_ok: false, descricao: 'Grupo do designer' },
  { nome: "Migra e Instalação", chat_id: '',  bom_dia: false, alertas_notion_entrega: false, alertas_notion_ok: false, descricao: 'Grupo de migrações e instalações' },
  { nome: "Diário",             chat_id: '',  bom_dia: false, alertas_notion_entrega: false, alertas_notion_ok: false, descricao: 'Grupo diário' },
]

async function seedIfEmpty() {
  const count = await query('SELECT COUNT(*) FROM grupos_whatsapp')
  if (parseInt(count.rows[0].count) > 0) return

  // Tenta ler o JID atual do grupo principal do dashboard_config
  let jidPrincipal = ''
  try {
    const cfg = await query("SELECT valor FROM dashboard_config WHERE chave = 'bom_dia_grupo'")
    jidPrincipal = cfg.rows[0]?.valor || ''
  } catch {}

  for (let i = 0; i < GRUPOS_INICIAIS.length; i++) {
    const g = GRUPOS_INICIAIS[i]
    const chatId = i === 0 ? jidPrincipal : g.chat_id
    await query(
      `INSERT INTO grupos_whatsapp (nome, chat_id, descricao, bom_dia, alertas_notion_entrega, alertas_notion_ok)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [g.nome, chatId, g.descricao, g.bom_dia, g.alertas_notion_entrega, g.alertas_notion_ok]
    )
  }
}

export async function GET() {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    await ensureTable()
    await seedIfEmpty()
    const r = await query('SELECT * FROM grupos_whatsapp ORDER BY id ASC')
    return NextResponse.json(r.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    await ensureTable()
    const { nome, chat_id = '', descricao = '', bom_dia = false, alertas_notion_entrega = false, alertas_notion_ok = false } = await req.json()
    if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    const r = await query(
      `INSERT INTO grupos_whatsapp (nome, chat_id, descricao, bom_dia, alertas_notion_entrega, alertas_notion_ok)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nome.trim(), (chat_id || '').trim(), descricao.trim(), bom_dia, alertas_notion_entrega, alertas_notion_ok]
    )
    return NextResponse.json(r.rows[0], { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
