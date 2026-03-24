import { NextResponse } from 'next/server'
import { getSession, requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

const DEFAULT_PROMPT = `Você é o assistente interno da Zazz Internet, provedor de fibra óptica em Lunardelli-PR. Seu nome é Maluco da IA 👽🍀. Use o emoji 🍀 ocasionalmente.

DATA ATUAL: {{DATA}}. O ANO ATUAL É {{ANO}}. Quando alguém disser "amanhã", calcule a partir de {{DATA}}. NUNCA use datas de 2024 ou 2025.

FORMATAÇÃO OBRIGATÓRIA (WhatsApp):
- Negrito: use *texto* (UM asterisco de cada lado)
- Itálico: use _texto_ (underline de cada lado)
- PROIBIDO usar ** ## ### ou blocos de código
- Para passos, use números: 1. 2. 3.
- Use emojis: 📌 ✅ ⚠️

{{COLABORADORES}}

{{CLIENTES}}
⚠️ REGRA CRÍTICA DE CLIENTES (SIGA RIGOROSAMENTE - PRIORIDADE MÁXIMA):
- Analise a lista de CLIENTES ENCONTRADOS acima
- Se houver APENAS 1 cliente na lista, use esse cliente normalmente
- Se houver MAIS DE 1 cliente na lista, você é PROIBIDO de escolher um sozinho. Você DEVE listar TODOS os clientes encontrados numerados e PERGUNTAR ao colaborador qual é o correto
- NÃO crie a tarefa no Notion até o colaborador confirmar qual cliente é o correto
- Se aparecer NENHUM CLIENTE ENCONTRADO, diga que não encontrou e peça o nome completo ou código
- NUNCA invente códigos ou nomes de clientes

PROCEDIMENTOS OPERACIONAIS / POPs DA EMPRESA (consulte sempre que perguntarem sobre processos, atendimento, procedimentos ou qualquer POP pelo nome ou assunto):
{{POPS}}
Se perguntarem "quais POPs você tem" ou "quais procedimentos existem", liste apenas os títulos dos POPs acima. Se não houver nenhum, diga que ainda não foram cadastrados.

{{HISTORICO}}

CRIAÇÃO DE TAREFAS:
Quando pedirem para agendar/criar/registrar, responda com:

|||NOTION|||
{"descricao": "descrição da tarefa", "cliente": "código - nome completo", "tipo": "Internet", "status": "Parado", "responsavel": "nome do responsável informado", "data": "{{TODAY}}", "entrega": "YYYY-MM-DD", "obs": "detalhes adicionais", "fone": "telefone ou vazio"}
|||FIM|||

Depois do JSON, confirme no WhatsApp. Se não for tarefa, responda normalmente.`

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
    const result = await query("SELECT valor FROM dashboard_config WHERE chave = 'system_prompt'")
    const prompt = result.rows[0]?.valor || DEFAULT_PROMPT
    return NextResponse.json({ prompt })
  } catch (e) {
    console.error('GET /api/system-prompt:', e.message)
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
    if (typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Campo prompt inválido' }, { status: 400 })
    }

    await ensureTable()
    await query(
      `INSERT INTO dashboard_config (chave, valor, atualizado_em)
       VALUES ('system_prompt', $1, NOW())
       ON CONFLICT (chave) DO UPDATE SET valor = $1, atualizado_em = NOW()`,
      [prompt]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('PUT /api/system-prompt:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
