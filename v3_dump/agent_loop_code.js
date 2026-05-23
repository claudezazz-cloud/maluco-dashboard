// ============================================================
// AGENT LOOP — tool_use real (Notion create/resolve + cliente lookup)
// Lê $json.claudeBody (do Monta Prompt) e produz a mesma forma que a Claude API
// HTTP devolvia: { content:[{text:...}], usage:{input_tokens, output_tokens} }
// ============================================================

const API_KEY = 'REDACTED-ANTHROPIC-KEY';

const NOTION_TOKEN = 'REDACTED-NOTION-TOKEN';
const NOTION_DB = 'd54e5911e8af43dfaed8f2893e59f6ef';
const DASH_TOKEN = 'MALUCO_POPS_2026';
const DASH_BASE = 'https://dashboard.srv1537041.hstgr.cloud';

const RESPONSAVEL_MAP = {
  'junior': '60f09078-44d0-4a2e-9b56-b8917fdfd87e',
  'franquelin': '826e94f5-aed7-4421-ae97-deee67c6f6af',
  'franque': '826e94f5-aed7-4421-ae97-deee67c6f6af',
  'luiz': 'f6b0bba1-309e-46a9-9b37-d5a18c150a16',
  'negos': '7630461f-d189-4b51-a139-28043faae78f',
  'nego': '7630461f-d189-4b51-a139-28043faae78f',
  'gester': '7630461f-d189-4b51-a139-28043faae78f',
  'victor': '309d872b-594c-8150-a655-0002842c1ef6',
  'vitor': '309d872b-594c-8150-a655-0002842c1ef6',
  'russo': '60f09078-44d0-4a2e-9b56-b8917fdfd87e'
};
const ATENDENTE_FIXO = '325d872b-594c-81fe-a524-00029761e655';

// Lista fixa dos tipos validos no Notion DB. Atualizar quando adicionar/remover via UI do Notion.
// Sincronizada em 2026-05-01.
// IMPORTANTE: case-sensitive. Bate exatamente com as opcoes do multi_select Tipo no Notion.
// Se mexer (criar/remover) tipos no Notion, atualizar essa lista — senao bot pode criar opcoes duplicadas.
const TIPOS_VALIDOS = [
  '5S','Acrílico','Carimbo','Adesivo','Cartão de Visita','Outros','crachá','Digitação',
  'Encadernação','Fachada','Fotos','Impressão','Internet','MDF','Gráfica','Placa',
  'Plastificação','Telefone Fixo','Xerox','Zazz','Lona','rifa','Equip. Perdido',
  'Banner/Faixa','Adesivo Recorte','Arte','Cardápio','Cartão Crachá','Perfurado',
  'lon','panfletos','fichas','Bloquinho Destacavel','Medalha'
];

const TOOLS = [
  {
    name: 'buscar_cliente',
    description: 'Busca clientes ativos da Zazz por nome ou código. Use quando o usuário mencionar um nome de cliente e você precisar do código exato.',
    input_schema: {
      type: 'object',
      properties: { q: { type: 'string', description: 'Nome parcial ou código do cliente.' } },
      required: ['q']
    }
  },
  {
    name: 'criar_tarefa_notion',
    description: 'Cria UMA tarefa nova no banco de tarefas do Notion da Zazz. Use quando alguém pedir para registrar/agendar uma tarefa.',
    input_schema: {
      type: 'object',
      properties: {
        descricao: { type: 'string', description: 'Descrição curta da tarefa (vai pro título).' },
        cliente: { type: 'string', description: 'Nome do cliente (opcional).' },
        status: { type: 'string', enum: ['Parado','Ok','Cancelado','Terminado'], description: 'Default: Parado' },
        tipo: { type: 'string', enum: TIPOS_VALIDOS, description: 'Tipo da tarefa. Escolha SEMANTICAMENTE o mais proximo do pedido (carimbo da Dra -> Carimbo, adesivo do Joao -> Adesivo, problema de internet -> Internet). Se nao souber, use Outros. NUNCA invente.' },
        data: { type: 'string', description: 'YYYY-MM-DD. Default: hoje.' },
        entrega: { type: 'string', description: 'YYYY-MM-DD. Default: data ou hoje.' },
        obs: { type: 'string', description: 'Observacoes livres. NAO repita aqui o valor — use o campo valor.' },
        fone: { type: 'string' },
        valor: { type: 'number', description: 'Valor em R$ (ex: 90, 150.50). Use SEMPRE quando o usuario citar preco. Numero puro, sem R$ nem virgula.' },
        responsavel: { type: 'string', description: 'Nome(s): junior, franquelin, luiz, negos, victor. Pode combinar com vírgula. Default: franquelin.' }
      },
      required: ['descricao']
    }
  },
  {
    name: 'resolver_tarefa_notion',
    description: 'Marca uma tarefa do Notion como Ok (resolvida). Passe o page_id (sem traços) que aparece em [id:...] na lista de tarefas.',
    input_schema: {
      type: 'object',
      properties: {
        page_id: { type: 'string', description: 'ID da página no Notion, sem traços.' },
        titulo: { type: 'string' },
        cliente: { type: 'string' }
      },
      required: ['page_id']
    }
  },
  {
    name: 'listar_tarefas_notion',
    description: 'Lista tarefas do Notion da Zazz (em aberto e resolvidas). Use quando perguntarem sobre tarefas, status, responsaveis, prazos, "o que fulano tem pra fazer", "quais tarefas estao paradas", etc. Retorna ate 50 tarefas com [id:...] no inicio de cada linha.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['Parado','Ok','Cancelado','Terminado','Todas'], description: 'Filtra por status. Default: Parado (em aberto).' }
      }
    }
  },
  {
    name: 'aprender_fato',
    description: 'Salva um fato/aprendizado durável sobre alguem ou algo da empresa. Use quando perceber padroes, preferencias, processos ou contextos uteis de longo prazo (ex: "Dra. Maria sempre pede carimbo com entrega segunda", "Junior costuma resolver chamados de visita tecnica", "cliente X mora em zona rural"). Nao use pra fatos triviais ou de momento. Os fatos sao acumulados em bot_memoria_longa e usados pra dar contexto em conversas futuras (em qualquer grupo). Deduplica por (entidade_tipo, entidade_id, fato).',
    input_schema: {
      type: 'object',
      properties: {
        entidade_tipo: { type: 'string', enum: ['cliente','colaborador','empresa','equipamento','processo','outro'], description: 'Categoria da entidade que o fato descreve.' },
        entidade_id:   { type: 'string', description: 'Nome ou identificador da entidade. Ex: "Junior Souza", "Dra. Maria", "Zazz Internet", "RBX".' },
        fato:          { type: 'string', description: 'Descricao curta do fato em 1-2 frases. Ex: "Sempre pede carimbo entrega segunda".' },
        peso:          { type: 'integer', description: '1 (trivial) a 10 (critico). Default 5.' },
        categoria:     { type: 'string', description: 'preferencia, processo, padrao, contexto, etc.' }
      },
      required: ['entidade_tipo','entidade_id','fato']
    }
  },
  {
    name: 'corrigir_fato',
    description: 'Corrige ou apaga um fato errado da memoria longa. Use SEMPRE que o usuario disser que algo que voce afirmou esta incorreto, "na verdade nao e isso", "esquece o que voce sabe sobre X", "isso ta errado, o certo e Y", etc. Desativa o fato antigo (preserva historico) e opcionalmente salva o novo com validado_por=user (peso alto pra nao ser sobrescrito por extracao automatica).',
    input_schema: {
      type: 'object',
      properties: {
        entidade_tipo: { type: 'string', enum: ['cliente','colaborador','empresa','equipamento','processo','outro'] },
        entidade_id:   { type: 'string', description: 'Mesma entidade do fato errado (ex: "Zazz Internet").' },
        busca:         { type: 'string', description: 'Trecho do fato errado pra localizar (ex: "RBX em momentos de venda"). Faz match ILIKE.' },
        novo_fato:     { type: 'string', description: 'Versao corrigida (opcional). Se omitido, so apaga.' },
        peso:          { type: 'integer', description: 'Default 7 (validado por usuario tem prioridade).' }
      },
      required: ['entidade_tipo','entidade_id','busca']
    }
  },
  {
    name: 'buscar_chamados',
    description: 'Busca o status atual dos chamados técnicos de suporte de internet da Zazz. Use quando perguntarem sobre chamados abertos, fila de atendimento, chamados por técnico, cidades com problema, quantos chamados estão pendentes, etc. Não precisa de parâmetros.',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'buscar_pop',
    description: 'Busca o conteúdo completo de um procedimento interno da Zazz (POP). Use SEMPRE antes de orientar um atendimento específico — nunca oriente de memória. Passe o título exato ou parcial conforme a lista de POPs disponíveis.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Título (ou parte) do POP a buscar. Ex: "Reclamação Serviço Indisponível", "Mudança de Senha", "Cancelamento".' }
      },
      required: ['titulo']
    }
  },
  {
    name: 'criar_lembrete',
    description: 'Agenda uma mensagem automatica para ser enviada neste grupo no futuro. Use em DOIS casos: (1) Usuario pede lembrete pessoal: "me lembre as 9h de verificar X", "lembra eu de ligar pra fulano as 14h", "me avisa amanha" — crie IMEDIATAMENTE sem perguntar; (2) Colaborador faz promessa com prazo: "amanha ligo pro cliente", "semana que vem verifico" — crie follow-up. NUNCA recuse ou diga que a ferramenta nao esta disponivel — ela sempre funciona. NUNCA diga "nao consigo criar" ou "fora do momento".',
    input_schema: {
      type: 'object',
      properties: {
        mensagem:     { type: 'string', description: 'Texto do lembrete. Pode incluir @numero pra marcar alguem. Ex: "@5544999998888 voce ia ligar pra Dra. Maria hoje, conseguiu?"' },
        agendar_para: { type: 'string', description: 'ISO 8601 com horario. Ex: "2026-05-03T09:00:00". Use horario comercial (08h-18h).' },
        criado_por:   { type: 'string', description: 'Nome de quem fez a promessa (opcional). Ex: "Junior".' }
      },
      required: ['mensagem','agendar_para']
    }
  }
];

function buildNotionBody(data) {
  const respNome = (data.responsavel || 'franquelin, victor').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  let respPeople = [];
  const added = new Set();
  for (const [key, id] of Object.entries(RESPONSAVEL_MAP)) {
    if (respNome.includes(key) && !added.has(id)) { respPeople.push({id}); added.add(id); }
  }
  if (respPeople.length === 0) respPeople = [{id:'826e94f5-aed7-4421-ae97-deee67c6f6af'}];
  const today = new Date().toISOString().split('T')[0];
  return {
    parent: { database_id: NOTION_DB },
    properties: {
      'Descrição': { title: [{ text: { content: data.descricao || '' } }] },
      'Cliente': { rich_text: [{ text: { content: data.cliente || '' } }] },
      'status': { select: { name: data.status || 'Parado' } },
      'Data': { date: { start: data.data || today } },
      'Tipo': { multi_select: [{ name: data.tipo || 'Internet' }] },
      'Entrega': { date: { start: data.entrega || data.data || today } },
      'Obs': { rich_text: [{ text: { content: data.obs || '' } }] },
      'Fone': { phone_number: data.fone || null },
      'Valor': { number: typeof data.valor === 'number' ? data.valor : (parseFloat(String(data.valor||'').replace(/[^0-9.,]/g,'').replace(',', '.')) || 0) },
      'Atendente': { people: [{ id: ATENDENTE_FIXO }] },
      'Responsável': { people: respPeople }
    }
  };
}

const _helpers = this.helpers;
async function http(opts) {
  // wrapper sobre helpers.httpRequest (sandbox do task-runner nao tem fetch)
  return await _helpers.httpRequest({
    method: opts.method || 'GET',
    url: opts.url,
    headers: opts.headers || {},
    body: opts.body,
    json: opts.json !== false,
    returnFullResponse: true,
    ignoreHttpStatusErrors: true
  });
}

async function executarTool(name, input) {
  try {
    if (name === 'buscar_chamados') {
      const r = await http({
        method: 'GET',
        url: `${DASH_BASE}/api/chamados/buscar`,
        headers: { 'x-token': DASH_TOKEN }
      });
      const data = r.body || {};
      if (!data.found) return data.mensagem || 'Chamados não disponíveis no momento.';
      const quando = data.importado_em ? ` (importado ${data.importado_em})` : '';
      return `⚠️ CHAMADOS DO SISTEMA${quando} — Total: ${data.total}\n\n${data.ai_context}`;
    }
    if (name === 'buscar_pop') {
      const titulo = encodeURIComponent(input.titulo || '');
      const r = await http({
        method: 'GET',
        url: `${DASH_BASE}/api/pops/buscar?titulo=${titulo}`,
        headers: { 'x-token': DASH_TOKEN }
      });
      const data = r.body || {};
      if (!data.found || !data.pop) return `POP não encontrado: "${input.titulo}". Verifique o título na lista de POPs disponíveis.`;
      const pop = data.pop;
      return `=== ${pop.titulo} ===\n${pop.conteudo || '(sem conteúdo)'}`;
    }
    if (name === 'buscar_cliente') {
      const q = encodeURIComponent(input.q || '');
      const r = await http({
        method: 'GET',
        url: `${DASH_BASE}/api/clientes/buscar?q=${q}&limit=10`,
        headers: { 'x-token': DASH_TOKEN }
      });
      const data = r.body || {};
      const lista = (data.resultados || []).map(c => `${c.cod} - ${c.nome}`).join('\n');
      return lista ? `Resultados:\n${lista}` : 'Nenhum cliente encontrado.';
    }
    if (name === 'criar_tarefa_notion') {
      // valida tipo contra lista fixa
      if (input.tipo && !TIPOS_VALIDOS.includes(input.tipo)) {
        return `Erro: tipo "${input.tipo}" nao existe no Notion. Use um dos: ${TIPOS_VALIDOS.join(', ')}. Escolha o mais proximo semanticamente do pedido.`;
      }
      const body = buildNotionBody(input);
      const r = await http({
        method: 'POST',
        url: 'https://api.notion.com/v1/pages',
        headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' },
        body
      });
      const data = r.body || {};
      if (r.statusCode >= 400) return `Erro ao criar tarefa: ${data.message || r.statusCode}`;
      return `Tarefa criada com sucesso. page_id=${(data.id || '').replace(/-/g,'')} | ${input.descricao}${input.cliente ? ' | cliente: '+input.cliente : ''}`;
    }
    if (name === 'resolver_tarefa_notion') {
      const pid = String(input.page_id || '').replace(/-/g, '');
      if (!pid) return 'Erro: page_id ausente.';
      const r = await http({
        method: 'PATCH',
        url: `https://api.notion.com/v1/pages/${pid}`,
        headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' },
        body: { properties: { 'status': { select: { name: 'Ok' } } } }
      });
      const data = r.body || {};
      if (r.statusCode >= 400) return `Erro ao resolver: ${data.message || r.statusCode}`;
      return `Tarefa marcada como Ok. ${input.titulo || ''}${input.cliente ? ' (cliente: '+input.cliente+')' : ''}`;
    }
    if (name === 'corrigir_fato') {
      const r = await http({
        method: 'POST',
        url: `${DASH_BASE}/api/memoria/corrigir`,
        headers: { 'x-token': DASH_TOKEN },
        body: {
          entidade_tipo: input.entidade_tipo,
          entidade_id: input.entidade_id,
          busca: input.busca,
          novo_fato: input.novo_fato,
          peso: input.peso
        }
      });
      const data = r.body || {};
      if (r.statusCode >= 400) return `Erro ao corrigir fato: ${data.error || r.statusCode}`;
      const partes = [];
      if (data.desativados) partes.push(`${data.desativados} fato(s) antigo(s) desativado(s)`);
      if (data.novo) partes.push(`novo fato salvo (peso ${data.novo.peso})`);
      return partes.length ? partes.join(', ') + '.' : 'Nada a corrigir (busca nao encontrou matches).';
    }
    if (name === 'aprender_fato') {
      const r = await http({
        method: 'POST',
        url: `${DASH_BASE}/api/memoria/aprender`,
        headers: { 'x-token': DASH_TOKEN },
        body: {
          entidade_tipo: input.entidade_tipo,
          entidade_id: input.entidade_id,
          fato: input.fato,
          peso: input.peso,
          categoria: input.categoria
        }
      });
      const data = r.body || {};
      if (r.statusCode >= 400) return `Erro ao salvar fato: ${data.error || r.statusCode}`;
      return `Fato registrado: ${input.entidade_tipo}/${input.entidade_id} (peso ${data.peso}, ja visto ${data.ocorrencias}x).`;
    }
    if (name === 'listar_tarefas_notion') {
      const status = input.status || 'Parado';
      const filter = (status === 'Todas') ? undefined : { property: 'status', select: { equals: status } };
      const r = await http({
        method: 'POST',
        url: `https://api.notion.com/v1/databases/${NOTION_DB}/query`,
        headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' },
        body: { ...(filter ? { filter } : {}), sorts: [{ property: 'Data', direction: 'descending' }], page_size: 50 }
      });
      if (r.statusCode >= 400) return `Erro ao listar: ${r.body?.message || r.statusCode}`;
      const results = r.body?.results || [];
      if (!results.length) return `Nenhuma tarefa com status ${status}.`;
      const linhas = results.map(p => {
        const props = p.properties || {};
        const pid = (p.id || '').replace(/-/g, '');
        const desc = props['Descrição']?.title?.map(t => t.plain_text).join('') || '(sem descricao)';
        const cli = props['Cliente']?.rich_text?.map(t => t.plain_text).join('') || '';
        const st = props['status']?.select?.name || '';
        const data = props['Data']?.date?.start || '';
        const entrega = props['Entrega']?.date?.start || '';
        const resp = (props['Responsável']?.people || []).map(pe => pe.name || pe.id).join(', ');
        let l = `- [id:${pid}] [${st}] ${desc}`;
        if (cli) l += ` | cliente: ${cli}`;
        if (data) l += ` | data: ${data}`;
        if (entrega) l += ` | entrega: ${entrega}`;
        if (resp) l += ` | resp: ${resp}`;
        return l;
      }).join('\n');
      return `${results.length} tarefa(s) com status ${status}:\n${linhas}`;
    }
    if (name === 'criar_lembrete') {
      // Precisa do chat_id do grupo atual para resolver o grupo
      const chatId = $input.first().json.chatId || $input.first().json.chat_id || '';
      if (!chatId) return 'Erro: nao foi possivel identificar o chat atual para criar o lembrete.';
      const r = await http({
        method: 'POST',
        url: `${DASH_BASE}/api/lembretes`,
        headers: { 'x-token': DASH_TOKEN },
        body: {
          chat_id: chatId,
          mensagem: input.mensagem,
          agendar_para: input.agendar_para,
          criado_por: input.criado_por
        }
      });
      const data = r.body || {};
      if (r.statusCode >= 400) return `Erro ao criar lembrete: ${data.error || r.statusCode}`;
      const dt = new Date(data.agendar_para).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
      return `Lembrete agendado para ${dt} no grupo ${data.grupo}. id=${data.id}.`;
    }
    return `Tool desconhecida: ${name}`;
  } catch (e) {
    return `Excecao: ${String(e).substring(0, 300)}`;
  }
}

async function callClaude(body) {
  const r = await http({
    method: 'POST',
    url: 'https://api.anthropic.com/v1/messages',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body
  });
  if (r.statusCode >= 400) {
    const msg = r.body?.error?.message || JSON.stringify(r.body || {}).substring(0, 300);
    throw new Error(`Claude API ${r.statusCode}: ${msg}`);
  }
  return r.body;
}

const claudeBody = $input.first().json.claudeBody;
if (!claudeBody) throw new Error('claudeBody ausente — Monta Prompt não emitiu nada.');

const messages = [...claudeBody.messages];
const baseBody = {
  model: claudeBody.model,
  max_tokens: claudeBody.max_tokens,
  system: claudeBody.system,
  tools: TOOLS
};

let totalIn = 0, totalOut = 0;
let finalContent = null;
const MAX_ITER = 5;

// Detecta intenção de lembrete na ÚLTIMA mensagem do usuário pra forçar tool_choice.
// Bug 19/21: Sonnet hallucinava "Lembrete criado" sem chamar a tool, copiando padrão de turnos antigos.
function lastUserText(msgs) {
  for (let j = msgs.length - 1; j >= 0; j--) {
    const m = msgs[j];
    if (m.role !== 'user') continue;
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) {
      const t = m.content.find(c => c?.type === 'text');
      if (t) return t.text || '';
    }
  }
  return '';
}
const LEMBRETE_INTENT = /\b(me\s+lembr|me\s+avis|lembra\s+eu|lembrete|agend[ae]\s+(?:um\s+)?lembret|criar?\s+(?:um\s+)?lembret|fa[çc]a\s+(?:um\s+)?lembret)/i;
// Comandos /chamados ou /relatorio exigem buscar_chamados antes de responder.
// Sem isso o Haiku às vezes inventa "não tenho chamados" mesmo com Redis populado.
const CHAMADOS_INTENT = /(?:^|\s)\/(?:chamados?|relatorio|relat[óo]rio)\b|chamados?\s+em\s+aberto|chamados?\s+(?:de\s+)?hoje|fila\s+de\s+chamados?|resumo\s+(?:do\s+)?dia/i;
const userTxt = lastUserText(messages);
const forceLembrete = LEMBRETE_INTENT.test(userTxt);
const forceChamados = CHAMADOS_INTENT.test(userTxt);
let forcedAlready = false;
let forcedChamadosAlready = false;

for (let i = 0; i < MAX_ITER; i++) {
  const body = { ...baseBody, messages };
  // Força chamada de criar_lembrete na 1ª iteração quando a intenção é clara.
  if (forceLembrete && !forcedAlready && i === 0) {
    body.tool_choice = { type: 'tool', name: 'criar_lembrete' };
    forcedAlready = true;
  }
  // Força buscar_chamados na 1ª iteração quando o comando exige (/chamados, /relatorio, etc).
  // Tem precedência mais baixa que lembrete (lembrete é mais específico).
  else if (forceChamados && !forcedChamadosAlready && i === 0) {
    body.tool_choice = { type: 'tool', name: 'buscar_chamados' };
    forcedChamadosAlready = true;
  }
  const resp = await callClaude(body);
  totalIn += resp.usage?.input_tokens || 0;
  totalOut += resp.usage?.output_tokens || 0;

  if (resp.stop_reason === 'tool_use') {
    messages.push({ role: 'assistant', content: resp.content });
    const toolResults = [];
    for (const block of resp.content) {
      if (block.type === 'tool_use') {
        const result = await executarTool(block.name, block.input || {});
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }
    }
    messages.push({ role: 'user', content: toolResults });
    continue;
  }

  // Defesa: se o texto final afirma "Lembrete criado/agendado" sem nenhuma tool ter sido chamada
  // nesta resposta, é hallucination. Reinjeta como user e força a tool.
  const respText = (resp.content || []).filter(b => b.type === 'text').map(b => b.text || '').join(' ');
  const hallucinaLembrete = /lembrete\s+(criad|agendad|marcad)|agendei\s+o?\s*lembret|marquei\s+o?\s*lembret/i.test(respText);
  const teveToolUse = (resp.content || []).some(b => b.type === 'tool_use');
  if (hallucinaLembrete && !teveToolUse && i < MAX_ITER - 1) {
    // Não persiste a resposta hallucinada — pede pra refazer com tool forçada.
    messages.push({ role: 'assistant', content: resp.content });
    messages.push({ role: 'user', content: 'Você afirmou que criou um lembrete mas não chamou a tool criar_lembrete. Chame a tool agora com os parâmetros corretos.' });
    // próxima iter vai forçar a tool
    forcedAlready = false;
    continue;
  }

  finalContent = resp.content;
  break;
}

if (!finalContent) {
  finalContent = [{ type: 'text', text: 'Tive um problema processando sua pergunta (limite de iterações).' }];
}

return [{
  json: {
    content: finalContent,
    usage: { input_tokens: totalIn, output_tokens: totalOut },
    stop_reason: 'end_turn'
  }
}];
