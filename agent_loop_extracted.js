const response = $input.first().json;

// Tokens
const tokensInput = response.usage?.input_tokens || 0;
const tokensOutput = response.usage?.output_tokens || 0;

// Erro da API
if (response.error || !response.content) {
  let _vME; try { _vME = $('Verifica Menção').first().json; if (!_vME.chatId) _vME = null; } catch(e) {}
  if (!_vME) try { _vME = $('Formata Transcrição').first().json; if (!_vME.chatId) _vME = null; } catch(e) {}
  if (!_vME) try { _vME = $('Formata Imagem').first().json; } catch(e) { _vME = {}; }
  const errMsg = response.error?.message || response.message || JSON.stringify(response).substring(0,300);
  return [{ json: {
    chatId: _vME.chatId || '',
    message: '❌ Tive um probleminha técnico, tenta de novo em instantes 🍀',
    hasNotion: false, isError: true,
    errorMsg: errMsg,
    mensagemUsuario: _vME.textMessage || '',
    novoHistorico: '[]', tokensInput: 0, tokensOutput: 0, popsUsados: '', remetente: ''
  }}];
}

let fullText = '';
if (response.content && Array.isArray(response.content)) {
  for (const block of response.content) {
    if (block.type === 'text' && block.text) {
      fullText += block.text + '\n';
    }
  }
}
fullText = fullText.trim();
let _vM; try { _vM = $('Verifica Menção').first().json; if (!_vM.chatId || !_vM.textMessage) _vM = null; } catch(e) {}
if (!_vM) try { _vM = $('Formata Transcrição').first().json; if (!_vM.chatId) _vM = null; } catch(e) {}
if (!_vM) try { _vM = $('Formata Imagem').first().json; } catch(e) { _vM = {}; }
const chatId = _vM.chatId || '';

const responsavelMap = {
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

let notionData = null;
let whatsappMessage = fullText;  // sera substituido por fullTextNoOks abaixo se houver acao
let notionBody = null;
let notionBodies = [];

function buildNotionBody(data) {
  const respNome = (data.responsavel || 'franquelin, victor').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let respPeople = [];
  let addedIds = [];
  for (const [key, id] of Object.entries(responsavelMap)) {
    if (respNome.includes(key) && !addedIds.includes(id)) {
      respPeople.push({"id": id});
      addedIds.push(id);
    }
  }
  if (respPeople.length === 0) {
    respPeople = [{"id": "826e94f5-aed7-4421-ae97-deee67c6f6af"}];
  }
  return {
    "parent": {"database_id": "d54e5911e8af43dfaed8f2893e59f6ef"},
    "properties": {
      "Descrição": {"title": [{"text": {"content": data.descricao || ""}}]},
      "Cliente": {"rich_text": [{"text": {"content": data.cliente || ""}}]},
      "status": {"select": {"name": data.status || "Parado"}},
      "Data": {"date": data.data ? {"start": data.data} : {"start": new Date().toISOString().split('T')[0]}},
      "Tipo": {"multi_select": [{"name": data.tipo || "Internet"}]},
      "Entrega": {"date": (data.entrega || data.data) ? {"start": data.entrega || data.data} : {"start": new Date().toISOString().split('T')[0]}},
      "Obs": {"rich_text": [{"text": {"content": data.obs || ""}}]},
      "Fone": {"phone_number": data.fone || null},
      "Valor": {"number": 0},
      "Atendente": {"people": [{"id": "325d872b-594c-81fe-a524-00029761e655"}]},
      "Responsável": {"people": respPeople}
    }
  };
}

// ============================================================
// NOTION_OK: |||NOTION_OK|||{"page_id":"..."}|||FIM|||
// ============================================================
let notionOks = [];
let senderName = '';
try { senderName = ($('Monta Prompt').first().json?.remetente || '').replace(/[^\p{L}\p{N} _-]/gu, '').trim(); } catch(e) {}
{
  const okRe = /\|\|\|NOTION_OK\|\|\|([\s\S]*?)\|\|\|FIM\|\|\|/g;
  const okMatches = [...fullText.matchAll(okRe)];
  for (const m of okMatches) {
    try {
      const data = JSON.parse(m[1].trim());
      if (data.page_id) notionOks.push({
        page_id: String(data.page_id).replace(/-/g, ''),
        titulo: data.titulo || '',
        cliente: data.cliente || ''
      });
    } catch(e) { /* ignora */ }
  }
}
// remove os blocos NOTION_OK do texto antes da varredura NOTION
const fullTextNoOks = fullText.replace(/\|\|\|NOTION_OK\|\|\|[\s\S]*?\|\|\|FIM\|\|\|/g, '').trim();

// Legacy |||NOTION||| create path REMOVIDO (Bug 23, 2026-05-04).
// Criação de tarefa Notion agora é EXCLUSIVAMENTE via tool criar_tarefa_notion no agent loop.
// Se Sonnet emitir o marcador antigo, ele é apenas removido do texto (não cria nada).
const hadLegacyMark = fullTextNoOks.includes('|||NOTION|||');
whatsappMessage = fullTextNoOks.replace(/\|\|\|NOTION\|\|\|[\s\S]*?\|\|\|FIM\|\|\|/g, '').trim();
if (hadLegacyMark) {
  console.log('[Parse_Resposta] caminho legacy |||NOTION||| detectado e ignorado — usar tool criar_tarefa_notion');
}

// Monta histórico atualizado para Redis
if (!whatsappMessage || whatsappMessage.trim() === '') {
  whatsappMessage = '✅ Operação processada.';
}

let _prevHist = [];
try { const rv2 = $('Busca Histórico Redis').first().json?.propertyName || $('Busca Histórico Redis').first().json?.value; if(rv2) _prevHist = JSON.parse(rv2); } catch(e) {}
let _msgUsr = ''; try { _msgUsr = $('Verifica Menção').first().json?.textMessage || $('Formata Transcrição').first().json?.textMessage || $('Formata Imagem').first().json?.textMessage || ''; } catch(e) {}
let _popsUsd = ''; try { _popsUsd = $('Monta Prompt').first().json?.popsUsados || ''; } catch(e) {}
let _rem = ''; try { _rem = $('Monta Prompt').first().json?.remetente || ''; } catch(e) {}
// ts ISO em cada turno — Monta Prompt usa pra prefixar com [DD/MM HH:MM] e Claude não confunde
// mensagens de dias anteriores com "hoje" (bug 18/05/2026).
const _ts = new Date().toISOString();
const novoHistorico = JSON.stringify([..._prevHist, {role:'user',content:_msgUsr.substring(0,2000),ts:_ts}, {role:'assistant',content:whatsappMessage.substring(0,4000),ts:_ts}].slice(-20));

return [{
  json: {
    chatId: chatId,
    message: whatsappMessage,
    notionData: notionData,
    notionBody: notionBody,
    notionBodies: notionBodies,
    notionOks: notionOks,
    hasNotion: notionBodies.length > 0,
    hasOk: notionOks.length > 0,
    senderName: senderName,
    isError: false,
    novoHistorico: novoHistorico,
    mensagemUsuario: _msgUsr,
    remetente: _rem,
    popsUsados: _popsUsd,
    tokensInput: tokensInput,
    tokensOutput: tokensOutput
  }
}];
