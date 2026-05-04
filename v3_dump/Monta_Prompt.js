// ============================================================
// MONTA PROMPT - MÁXIMA PERFORMANCE + LEIA SEMPRE
// ============================================================

// HISTORICO REDIS
let redisHistory = [];
try {
  const rv = $('Busca Histórico Redis').first().json?.propertyName || $('Busca Histórico Redis').first().json?.value;
  if (rv) redisHistory = JSON.parse(rv).filter(m => m.content && (typeof m.content === 'string' ? m.content.trim() : true));
} catch(e) {}

// CHAMADOS
let chamadosContext = '';
try {
  const cv = $('Busca Chamados Redis').first().json?.propertyName || $('Busca Chamados Redis').first().json?.value;
  if (cv) {
    const chamadosData = JSON.parse(cv);
    if (chamadosData.ai_context) {
      chamadosContext = '\n\n⚠️ CHAMADOS DO SISTEMA (ATUALIZADOS AGORA - DADOS OFICIAIS):\n'
        + 'REGRAS OBRIGATORIAS SOBRE CHAMADOS:\n'
        + '1. Os numeros no resumo abaixo sao EXATOS e PRE-CALCULADOS. NUNCA reconte.\n'
        + '2. Confie no resumo. NAO diga que precisa acessar outro sistema.\n\n'
        + chamadosData.ai_context.substring(0, 30000);
    }
  }
} catch(e) {}


// TAREFAS NOTION
let tarefasContext = '';
try {
  const notionResp = $('Busca Tarefas Notion').first().json;
  const results = notionResp?.results || [];
  if (results.length > 0) {
    const fmt = (p) => {
      const props = p.properties || {};
      const pageId = (p.id || '').replace(/-/g, '');
      const desc = props['Descrição']?.title?.map(t => t.plain_text).join('') || '(sem descrição)';
      const cliente = props['Cliente']?.rich_text?.map(t => t.plain_text).join('') || '';
      const status = props['status']?.select?.name || '';
      const data = props['Data']?.date?.start || '';
      const entrega = props['Entrega']?.date?.start || '';
      const tipo = (props['Tipo']?.multi_select || []).map(t => t.name).join(', ');
      const obs = props['Obs']?.rich_text?.map(t => t.plain_text).join('') || '';
      const resp = (props['Responsável']?.people || []).map(pe => pe.name || pe.id).join(', ');
      let line = `- [id:${pageId}] [${status || 'sem status'}] ${desc}`;
      if (cliente) line += ` | cliente: ${cliente}`;
      if (tipo) line += ` | tipo: ${tipo}`;
      if (data) line += ` | data: ${data}`;
      if (entrega) line += ` | entrega: ${entrega}`;
      if (resp) line += ` | responsável: ${resp}`;
      if (obs) line += ` | obs: ${obs.substring(0, 200)}`;
      return line;
    };
    const linhas = results.map(fmt).join('\n');
    tarefasContext = '\n\n📋 TAREFAS NO NOTION (atualizadas agora, ' + results.length + ' tarefas):\n'
      + 'Quando perguntarem sobre tarefas, status (parado, em andamento, concluído), responsáveis ou prazos, USE A LISTA ABAIXO como fonte única.\n'
      + 'Para listas longas, agrupe por status. Nunca invente tarefas que não estão aqui.\n'
      + 'Cada tarefa tem [id:<hash>] no inicio da linha. Use esse id para marcar como Ok.\n\n'
      + 'PARA MARCAR UMA TAREFA COMO OK NO NOTION (quando alguem disser que resolveu/concluiu/fechou):\n'
      + 'Emita no FIM da resposta (uma vez por tarefa marcada):\n'
      + '|||NOTION_OK|||{"page_id":"<id da tarefa>","titulo":"<descricao curta>","cliente":"<nome cliente>"}|||FIM|||\n'
      + 'Use SEMPRE o id exato da lista abaixo (sem traços). Nao invente ids. Se ambiguo, pergunte qual.\n'
      + 'Se for confirmar acao do usuario ("Sim", "pode marcar"), olhe no historico qual tarefa estava sendo discutida e use o id dela.\n\n'
      + linhas;
  }
} catch(e) {}


// RESOLVIDOS HOJE (diff de snapshots — quem fechou quantos chamados)
let resolvidosContext = '';
try {
  const resp = $('Busca Resolvidos Hoje').first().json;
  if (resp && resp.total_resolvidos > 0 && resp.ai_text) {
    resolvidosContext = '\n\n🏁 CHAMADOS RESOLVIDOS HOJE (calculado por diff de snapshots — DADOS OFICIAIS):\n'
      + 'Quando perguntarem "quem resolveu chamados hoje", "quantos chamados o fulano fechou", "ranking", USE este bloco.\n'
      + 'Os números são EXATOS, pré-calculados. Nunca reconte ou invente.\n\n'
      + resp.ai_text;
  }
} catch(e) {}

// REMETENTE
let remetente = '';
try { remetente = $('Extrai Dados Mensagem').first().json?.dbRemetente || ''; } catch(e) {}

// 1. REGRAS
let rules = '';
try {
  const rulesData = $('Busca Regras').all().map(r => r.json.regra).filter(Boolean);
  rules = [...new Set(rulesData)].slice(0, 30).join('\n- ');
} catch(e) {}
const rulesPrompt = rules ? '\n\n⚠️ REGRAS ADICIONAIS DE TREINAMENTO (Siga Rigorosamente):\n- ' + rules : '';


// SKILL CONTEXT
let skillContext = '';
try {
  const skillName = $('Verifica Menção').first().json?.skillName || null;
  if (skillName) {
    const skills = $('Busca Skills').all().map(s => s.json).filter(s => s.nome);
    const skill = skills.find(s => s.nome === skillName);
    if (skill?.prompt_base) {
      const skillArgs = $('Verifica Menção').first().json?.skillArgs || '';
      skillContext = '\n\n[SKILL] SKILL ATIVADA: ' + skillName + '\n' + skill.prompt_base;
      if (skillArgs) skillContext += '\n\nParametros: ' + skillArgs;
    }
  }
} catch(e) {}

// 2. SYSTEM PROMPT
let systemPromptTemplate = null;
try {
  const spRows = $('Busca System Prompt').all().map(d => d.json);
  for (const r of spRows) {
    if (r.chave === 'system_prompt' && r.valor) { systemPromptTemplate = r.valor; break; }
  }
  if (systemPromptTemplate && systemPromptTemplate.length > 50000) {
    systemPromptTemplate = systemPromptTemplate.substring(0, 50000) + '\n[...truncado...]';
  }
} catch(e) {}

// 3. HISTÓRICO DO GRUPO
let historicoSection = '';
try {
  const histRows = $('Busca Histórico 10').all().map(e => e.json);
  const histMap = new Map();
  for (const h of histRows) { if (h.id) histMap.set(h.id, h); }
  const uniqueHist = Array.from(histMap.values()).sort((a,b) => a.id - b.id).slice(-10);
  let historico = '';
  // Bug 19/contamination: respostas antigas do bot dizendo "ferramenta fora/indisponível"
  // viram self-fulfilling prophecy quando reinjetadas no histórico. Scrub.
  const FAIL_CONTAMINATION = /(ferramenta|tool)[\s\S]{0,40}(fora\s+do\s+ar|fora\s+no\s+momento|indispon[ií]vel|n[ãa]o\s+respond|n[ãa]o\s+est[áa]\s+funcion|off\s*line)/i;
  for (const msg of uniqueHist) {
    let hora = '??:??';
    try {
      const d = new Date(new Date(msg.data_hora).getTime() - 3 * 60 * 60 * 1000);
      hora = d.toISOString().substring(11, 16);
    } catch(e) {}
    let texto = (msg.mensagem || '').substring(0, 400);
    if (FAIL_CONTAMINATION.test(texto)) texto = '[resposta antiga do bot removida — bug de ferramenta corrigido]';
    historico += `[${hora}] ${msg.remetente}: ${texto}\n`;
  }
  if (historico) historicoSection = `\n\nÚLTIMAS MENSAGENS DO GRUPO:\n${historico}`;
} catch(e) {}

// 3b. EXTRAI TEXTO DA MENSAGEM (necessário para busca semântica de POPs)
let _vM_early;
try { _vM_early = $('Verifica Menção').first().json; if (!_vM_early.chatId || !_vM_early.textMessage) _vM_early = null; } catch(e) {}
if (!_vM_early) try { _vM_early = $('Formata Transcrição').first().json; if (!_vM_early.chatId) _vM_early = null; } catch(e) {}
if (!_vM_early) try { _vM_early = $('Formata Imagem').first().json; } catch(e) { _vM_early = {}; }
const textMessage = _vM_early.textMessage || '';
const quotedText = _vM_early.quotedText || '';

// 4. POPs — BUSCA SEMÂNTICA (top 5 relevantes + todos os títulos)
const allPopsInputs = $("Busca POPs").all().map(i => i.json).filter(p => p.titulo);
const popMap = new Map();
for (const p of allPopsInputs) {
  if (p.conteudo || !popMap.has(p.titulo)) popMap.set(p.titulo, p);
}
const uniquePops = Array.from(popMap.values());

// Relevância: conta palavras da mensagem que aparecem no POP
const stopwords = ['que','para','como','com','uma','por','dos','das','nao','mas','tem','sao','foi','ele','ela','isso','esse','esta','voce','aqui','hoje','fazer','pode','sobre','mais','tambem','quando','onde','qual','quais','muito','cada','todos','todo','ainda','acho','gente','nosso','nossa','vamos','bom','dia'];
const normaliza = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const msgPalavras = [...new Set(normaliza(textMessage || quotedText).split(/\s+/).filter(w => w.length > 2 && !stopwords.includes(w)))];

function calcRelevancia(pop) {
  const tituloNorm = normaliza(pop.titulo);
  const popTexto = normaliza(pop.titulo + ' ' + (pop.categoria || '') + ' ' + (pop.conteudo || '').substring(0, 800));
  let score = 0;
  for (const p of msgPalavras) {
    if (popTexto.includes(p)) score++;
    if (tituloNorm.includes(p)) score += 2;
  }
  return score;
}

let clientesContent = '';
const allNonClientTitles = [];
let leiasSemprePops = [];
const importantePops = [];
const scoredPops = [];

for (const pop of uniquePops) {
  const cat = (pop.categoria || '').toLowerCase();
  const titulo = (pop.titulo || '').toLowerCase();
  const isClientDB = cat.includes('cliente') || cat.includes('banco') || cat.includes('base') || cat.includes('crm');
  const prio = (pop.prioridade || 'relevante').toLowerCase();

  if (isClientDB) {
    if (pop.conteudo) clientesContent += pop.conteudo + '\n';
  } else if (prio === 'sempre') {
    if (pop.conteudo) leiasSemprePops.push(pop);
    allNonClientTitles.push(pop);
  } else if (prio === 'importante') {
    allNonClientTitles.push(pop);
    if (pop.conteudo) importantePops.push(pop);
  } else {
    allNonClientTitles.push(pop);
    if (pop.conteudo) scoredPops.push({ pop, score: calcRelevancia(pop) });
  }
}

// Todos os POPs recebem conteúdo completo (~44k chars = ok para Claude)
scoredPops.sort((a, b) => b.score - a.score);
const relevantNonClientPops = [
  ...importantePops,
  ...scoredPops.map(s => s.pop)
];

// 5. COLABORADORES
let colaboradoresArray = [];
try {
  const colabRows = $('Busca Colaboradores').all().map(i => i.json).filter(c => c.nome);
  const colabMap = new Map();
  for (const c of colabRows) colabMap.set(c.nome, c);
  colaboradoresArray = Array.from(colabMap.values());
} catch(e) {}

// 6. DADOS DA MENSAGEM
const _vM = _vM_early || {};
const chatId = _vM.chatId || '';

const now = new Date();
const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
const dia = brt.getDate().toString().padStart(2,'0');
const mes = (brt.getMonth()+1).toString().padStart(2,'0');
const ano = brt.getFullYear();
const today = `${ano}-${mes}-${dia}`;
const diasSemana = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
const diaSemana = diasSemana[brt.getDay()];
const msgLower = textMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// 7. MONTAGEM DOS POPs
const isListingPops = msgLower === '/pops' || msgLower.includes('listar pops') || msgLower.includes('quais pops') || msgLower.includes('quais procedimentos') || msgLower.startsWith('lista de pop');
let pops = '';

// POPs "LEIA SEMPRE" — aparecem em TODAS as respostas
if (leiasSemprePops.length > 0) {
  pops += '📌 LEIA ANTES DE RESPONDER:\n\n';
  for (const pop of leiasSemprePops) {
    pops += '=== ' + pop.titulo + ' ===\n' + pop.conteudo + '\n\n';
  }
  pops += '---\n\n';
}

if (relevantNonClientPops.length > 0 && !isListingPops) {
  pops += '\n--- PROCEDIMENTOS (POPs) ---\nREGRA: Voce TEM todos os POPs abaixo. NUNCA diga que nao localizou POP. Use este mapa para associar chamados aos POPs:\n- Perca de Equipamento = POP explicativo do processo de retira de equipamentos\n- Retencao / SPC / Cobranca = Processos Operacionais junto ao CCR\n- Mudanca de Contrato / Modificacao = Mudanca Contratual\n- Servico Instavel / Instabilidade = Reclamacao Servico com Instabilidade\n- Servico Indisponivel = Reclamacao Servico Indisponivel\n- Divergencia Financeira / Boletos = Alteracao e Correcao de Financeiro\n- Assinatura / Contrato / Vendas = Processo e fluxograma de uma nova venda\n- Mudanca de Endereco = Mudanca de Endereco\n- Mudanca de Senha = Mudanca de Senha Wifi\n- Instalacao / Modificacao tecnica = Modificacao da Instalacao\n- Comprovante = Comprovante de Pagamento\n- Desconto = Descontos de indicacao\nSempre aplique os PASSOS do POP correspondente.\n\n';
  for (const pop of relevantNonClientPops) {
    pops += '=== ' + pop.titulo + ' (' + (pop.categoria || 'Geral') + ') ===\n' + pop.conteudo + '\n\n';
  }
}

const popsUsados = isListingPops
  ? ''
  : [...leiasSemprePops, ...relevantNonClientPops].map(p => p.titulo).join(', ');

// 8. CLIENTES
let totalClientes = 0;
const clientesEncontrados = [];
try {
  const cliRows = $('Busca Clientes').all().map(i => i.json);
  for (const c of cliRows) {
    if (c.cod === 'TOTAL') { totalClientes = parseInt(c.nome) || 0; }
    else if (c.cod && c.nome) { clientesEncontrados.push(c.cod + ' - ' + c.nome); }
  }
} catch(e) {}

const clienteInfo = clientesEncontrados.length > 0
  ? 'CLIENTES ENCONTRADOS NA BUSCA: ' + clientesEncontrados.join(' | ') + ' (Total na base: ' + totalClientes + ')'
  : 'Base de clientes ativa com ' + totalClientes + ' clientes cadastrados. Quando mencionar um nome, os resultados aparecem automaticamente.';

const colaboradoresStr = colaboradoresArray.length > 0
  ? 'COLABORADORES DA EQUIPE:\n' + colaboradoresArray.map(c => {
      const tel = (c.telefone_whatsapp || '').replace(/\D/g, '');
      const telTag = tel ? ` | @marcar: @${tel}` : ' | (sem telefone — mencione pelo nome, nao tente @marcar)';
      return `- ${c.nome}${c.cargo ? ' (' + c.cargo + ')' : ''}${c.funcoes ? ': ' + c.funcoes : ''}${telTag}`;
    }).join('\n')
    + '\n\nREGRAS DE @MENCAO NO WHATSAPP:\n'
    + '- Para marcar alguem, use EXATAMENTE @<telefone> (so digitos, sem espaco/sinal). Ex: @5543999998888\n'
    + '- NUNCA invente um numero. Se a pessoa nao tem telefone na lista acima, escreva o NOME (sem @) ou nao marque.\n'
    + '- Nao use @<id>, @<algo_aleatorio>: o WhatsApp so reconhece @<telefone>.'
  : '';


// CONHECIMENTO EVOLUTIVO (notas Obsidian indexadas)
let evolutivoSection = '';
try {
  const evItems = $('Busca Evolutivo').all().map(i => i.json).filter(i => i.conteudo);
  if (evItems.length > 0) {
    const evScored = evItems.map(item => {
      const texto = normaliza((item.titulo || '') + ' ' + (item.conteudo || '').substring(0, 600));
      let score = 0;
      for (const p of msgPalavras) { if (texto.includes(p)) score++; }
      return { item, score };
    });
    evScored.sort((a, b) => b.score - a.score);
    const top = evScored.slice(0, 5).filter(e => e.score > 0 || evItems.length <= 5);
    if (top.length > 0) {
      const linhas = top.map(e => {
        const titulo = e.item.titulo ? `[${e.item.titulo}]\n` : '';
        return titulo + e.item.conteudo.substring(0, 1200);
      }).join('\n\n---\n\n');
      evolutivoSection = '\n\n## Conhecimento Evolutivo (complementar, nao normativo — POPs tem prioridade):\n' + linhas;
      if (evolutivoSection.length > 4200) evolutivoSection = evolutivoSection.substring(0, 4200) + '\n[...truncado...]';
    }
  }
} catch(e) {}


// MEMORIA DAS CAMADAS 2 E 3
let memoriaContext = '';
try {
  const memResp = $('Busca Memoria Contexto').first().json;
  if (memResp?.bloco_contexto) memoriaContext = '\n\n' + memResp.bloco_contexto;
} catch(e) {}

// 9. MONTAGEM FINAL DO SYSTEM CONTENT
let systemContent;
if (systemPromptTemplate && systemPromptTemplate !== '__RESET_TO_DEFAULT__') {
  systemContent = systemPromptTemplate
    .replace(/\{\{DATA\}\}/g, `${diaSemana}, ${dia}/${mes}/${ano}`)
    .replace(/\{\{ANO\}\}/g, String(ano))
    .replace(/\{\{TODAY\}\}/g, today)
    .replace(/\{\{COLABORADORES\}\}/g, colaboradoresStr)
    .replace(/\{\{CLIENTES\}\}/g, clienteInfo)
    .replace(/\{\{POPS\}\}/g, pops)
    .replace(/\{\{EVOLUTIVO\}\}/g, evolutivoSection)
    .replace(/\{\{HISTORICO\}\}/g, '__CACHE_SPLIT__')
    .replace(/\{\{REGRAS\}\}/g, rulesPrompt);
  systemContent = chamadosContext + tarefasContext + resolvidosContext + '\n' + systemContent;
} else {
  systemContent = rulesPrompt

    + skillContext
    + '\nVocê é o assistente interno da Zazz Internet, provedor de fibra óptica em Lunardelli-PR. Seu nome é Maluco da IA 👽🍀.\n\n'
    + 'DATA ATUAL: ' + diaSemana + ', ' + dia + '/' + mes + '/' + ano + ' (' + today + '). ANO ATUAL: ' + ano + '.\n\n'
    + 'FORMATAÇÃO OBRIGATÓRIA (WhatsApp):\n'
    + '- Negrito: *texto* (UM asterisco)\n'
    + '- Itálico: _texto_\n'
    + '- PROIBIDO: ** ## ### blocos de código\n'
    + '- Passos: use 1. 2. 3.\n\n'
    + colaboradoresStr + '\n\n'
    + clienteInfo + '\n\n'
    + 'POPs DA EMPRESA:\n' + pops
    + historicoSection
    + chamadosContext
    + tarefasContext
    + resolvidosContext;
}

// 10. LIMITE DE SEGURANÇA
if (systemContent.length > 80000) {
  systemContent = systemContent.substring(0, 80000) + '\n[...truncado por limite de memória...]';
}

// 11. TRAVA FINAL - permite @menção sem texto se houver contexto
const userMsg = textMessage || (quotedText ? '[respondendo à mensagem: "' + quotedText + '"]' : '[mencionou o bot]');
if (!textMessage && !quotedText && !historicoSection) return [];

return [{
  json: {
    chatId,
    remetente,
    mensagemUsuario: userMsg,
    popsUsados,
    chamadosCarregados: chamadosContext.length > 0 ? 'SIM (' + chamadosContext.length + ' chars)' : 'NAO',
    claudeBody: {
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: (function(){
  const marker = "__CACHE_SPLIT__";
  if (systemContent.includes(marker)) {
    const [stable, afterMarker] = systemContent.split(marker);
    const dynamic = (memoriaContext + historicoSection + (afterMarker || "") + skillContext).trim();
    const blocks = [ { type: "text", text: stable, cache_control: { type: "ephemeral" } } ];
    if (dynamic) blocks.push({ type: "text", text: dynamic });
    return blocks;
  }
  return systemContent;
})(),
      messages: [
        ...redisHistory.slice(-20),
        { role: "user", content: ((_vM_early.allImages && _vM_early.allImages.length) ? [ { type: "text", text: userMsg }, ..._vM_early.allImages.map(i => ({ type: "image", source: { type: "base64", media_type: i.mimetype, data: i.base64 } })) ] : (_vM_early.imageBase64 ? [ { type: "text", text: userMsg }, { type: "image", source: { type: "base64", media_type: _vM_early.imageMimetype, data: _vM_early.imageBase64 } } ] : userMsg)) }
      ]
    }
  }
}];