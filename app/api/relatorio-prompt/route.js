import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

const DEFAULT_PROMPT = `Gere um RELATÓRIO {PERIODO} das mensagens do grupo de trabalho da Zazz Internet.

🚫 REGRAS ABSOLUTAS (violação = resposta inválida):
1. Use APENAS as seções listadas abaixo — ZERO seções extras inventadas
2. NUNCA use ### ou ## — PROIBIDO. Use *negrito* e _itálico_ (WhatsApp)
3. NUNCA mencione Notion, N8N, banco de dados, Redis, sistema, nó, workflow ou qualquer infraestrutura interna
4. Se uma seção não tiver dados, OMITA ela completamente — não escreva nada sobre ela
5. Use APENAS o histórico de mensagens abaixo como fonte — não invente fatos

ESTRUTURA EXATA (copie os emojis e o formato):

*📋 RELATÓRIO {PERIODO}*
_{DATA}_

*🟢 SERVIÇOS CONCLUÍDOS:*
- [horário] _Cliente/Situação_ — resolvido por _Técnico_ ✅
(Se nenhum, escreva: - Nenhum serviço concluído registrado)

*🔴 SERVIÇOS PENDENTES:*
- [horário] _Cliente/Situação_ — solicitado por _Pessoa_ ⚠️
(Se nenhum, escreva: - Nenhum serviço pendente)

*📊 RESUMO GERAL:*
- Total de atendimentos: X
- Concluídos: X
- Pendentes: X
- Taxa de resolução: X%

*💡 DESTAQUES:*
- (situações críticas, padrões, observações — omitir seção se não houver nada relevante)`

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS dashboard_config (
      id SERIAL PRIMARY KEY,
      chave VARCHAR(255) UNIQUE NOT NULL,
      valor TEXT,
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `)
}

export async function GET() {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  try {
    await ensureTable()
    const result = await query("SELECT valor, atualizado_em FROM dashboard_config WHERE chave = 'relatorio_prompt'")
    const prompt = result.rows[0]?.valor || DEFAULT_PROMPT
    const atualizado_em = result.rows[0]?.atualizado_em || null
    return NextResponse.json({ prompt, atualizado_em, isDefault: !result.rows[0] })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req) {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  try {
    const { prompt } = await req.json()
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt inválido' }, { status: 400 })
    }
    await ensureTable()
    await query(
      `INSERT INTO dashboard_config (chave, valor, atualizado_em)
       VALUES ('relatorio_prompt', $1, NOW())
       ON CONFLICT (chave) DO UPDATE SET valor = $1, atualizado_em = NOW()`,
      [prompt]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE() {
  const session = await getSession()
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  try {
    await ensureTable()
    await query("DELETE FROM dashboard_config WHERE chave = 'relatorio_prompt'")
    return NextResponse.json({ ok: true, message: 'Prompt resetado para o padrão' })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
