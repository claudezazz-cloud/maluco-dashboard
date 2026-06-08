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

const fullText = response.content[0].text;
let _vM; try { _vM = $('Verifica Menção').first().json; if (!_vM.chatId || !_vM.textMessage) _vM = null; } catch(e) {}
if (!_vM) try { _vM = $('Formata Transcrição').first().json; if (!_vM.chatId) _vM = null; } catch(e) {}
if (!_vM) try { _vM = $('Formata Imagem').first().json; } catch(e) { _vM = {}; }
const chatId = _vM.chatId || '';

const responsavelMap = {
  'junior': '60f09078-44d0-4a2e-9b56-b8917fdfd87e',
  'franquelin': '826e94f5-aed7-4421-ae97-deee67c6f6af',
  'luiz': 'f6b0bba1-309e-46a9-9b37-d5a18c150a16',
  'negos': '7630461f-d189-4b51-a139-28043faae78f',
  'nego': '7630461f-d189-4b51-a139-28043faae78f',
  'gester': '7630461f-d189-4b51-a139-28043faae78f',
  'victor': 'f22c8443-ce89-49d6-94f4-3c6d391cf715',
  'vitor': 'f22c8443-ce89-49d6-94f4-3c6d391cf715',
  'russo': '60f09078-44d0-4a2e-9b56-b8917fdfd87e'
};

let notionData = null;
let whatsappMessage = fullText;
let notionBody = null;

let isImageReport = false;
let reportJson = null;

try {
  let cleanedText = fullText.trim();
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.replace(/^```json/, '').replace(/```$/, '').trim();
  }
  if (cleanedText.startsWith('{') && cleanedText.includes('"categorias"')) {
    reportJson = JSON.parse(cleanedText);
    isImageReport = true;
    whatsappMessage = "Bom dia, equipe Zazz! 🍀\nSegue o resumo das nossas operações e atendimentos.";
  } else if (cleanedText.startsWith('{') && cleanedText.includes('"isPdfReport"')) {
    const j = JSON.parse(cleanedText);
    if (j.isPdfReport && j.markdown) {
      try {
        const pdfResp = await this.helpers.httpRequest({
          method: 'POST',
          url: 'http://localhost:3001/api/report-pdf',
          headers: { 'Content-Type': 'application/json' },
          body: { markdown: j.markdown },
          json: true
        });
        if (pdfResp && pdfResp.base64) {
          await this.helpers.httpRequest({
            method: 'POST',
            url: 'https://lanlunar-evolution.cloudfy.live/message/sendMedia/ZazzClaude',
            headers: { 'apikey': 'REDACTED-EVO-KEY', 'Content-Type': 'application/json' },
            body: {
              number: chatId,
              mediatype: 'document',
              mimetype: 'application/pdf',
              fileName: `Resumo_Diario.pdf`,
              caption: '📄 Resumo Diário',
              media: pdfResp.base64
            },
            json: true
          });
          whatsappMessage = ''; // Evita envio de texto duplo
        }
      } catch(e) {
        console.error("Erro PDF:", e);
      }
    }
  }
} catch(e) {}


if (fullText.includes('|||NOTION|||')) {
  const notionMatch = fullText.match(/\|\|\|NOTION\|\|\|([\s\S]*?)\|\|\|FIM\|\|\|/);
  if (notionMatch) {
    try {
      notionData = JSON.parse(notionMatch[1].trim());

      const respNome = (notionData.responsavel || 'franquelin, victor').toLowerCase()
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

      notionBody = {
        "parent": {"database_id": "d54e5911e8af43dfaed8f2893e59f6ef"},
        "properties": {
          "Descrição": {"title": [{"text": {"content": notionData.descricao || ""}}]},
          "Cliente": {"rich_text": [{"text": {"content": notionData.cliente || ""}}]},
          "status": {"select": {"name": notionData.status || "Parado"}},
          "Data": {"date": {"start": notionData.data}},
          "Tipo": {"multi_select": [{"name": notionData.tipo || "Internet"}]},
          "Entrega": {"date": {"start": notionData.entrega || notionData.data}},
          "Obs": {"rich_text": [{"text": {"content": notionData.obs || ""}}]},
          "Fone": {"phone_number": notionData.fone || null},
          "Valor": {"number": 0},
          "Atendente": {"people": [{"id": "325d872b-594c-81fe-a524-00029761e655"}]},
          "Responsável": {"people": respPeople}
        }
      };

    } catch(e) {
      notionData = null;
    }
    whatsappMessage = fullText.replace(/\|\|\|NOTION\|\|\|[\s\S]*?\|\|\|FIM\|\|\|/, '').trim();
  }
}

// Monta histórico atualizado para Redis
let _prevHist = [];
try { const rv2 = $('Busca Histórico Redis').first().json?.value; if(rv2) _prevHist = JSON.parse(rv2); } catch(e) {}
let _msgUsr = ''; try { _msgUsr = $('Verifica Menção').first().json?.textMessage || $('Formata Transcrição').first().json?.textMessage || $('Formata Imagem').first().json?.textMessage || ''; } catch(e) {}
let _popsUsd = ''; try { _popsUsd = $('Monta Prompt').first().json?.popsUsados || ''; } catch(e) {}
let _rem = ''; try { _rem = $('Monta Prompt').first().json?.remetente || ''; } catch(e) {}
const novoHistorico = JSON.stringify([..._prevHist, {role:'user',content:_msgUsr.substring(0,2000)}, {role:'assistant',content:whatsappMessage.substring(0,4000)}].slice(-20));

return [{
  json: {
    chatId: chatId,
    message: whatsappMessage,
    notionData: notionData,
    notionBody: notionBody,
    hasNotion: notionBody !== null,
    isError: false,
    novoHistorico: novoHistorico,
    mensagemUsuario: _msgUsr,
    remetente: _rem,
    popsUsados: _popsUsd,
    tokensInput: tokensInput,
    tokensOutput: tokensOutput,
    isImageReport: isImageReport,
    reportJson: reportJson
  }
}];
