import { NextResponse } from 'next/server';

// Cria UMA tarefa no Notion. Encapsula o buildNotionBody que antes só existia no agent loop,
// pra que o worker da fila possa criar tarefas em lote. Auth por token interno.
const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026';
const NOTION_TOKEN = process.env.NOTION_TOKEN || '';
const NOTION_DB = process.env.NOTION_DB || 'd54e5911e8af43dfaed8f2893e59f6ef';

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
  'russo': '60f09078-44d0-4a2e-9b56-b8917fdfd87e',
};
const ATENDENTE_FIXO = '325d872b-594c-81fe-a524-00029761e655';

// Converte valor BR ("1.234,56", "R$ 50", "50,00") em número.
// Bug B9: o parse antigo trocava só a 1ª vírgula e mantinha o ponto de milhar,
// então "1.234,56" virava 1.234. Aqui tratamos milhar vs decimal corretamente.
function parseValorBR(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');   // 1.234,56 -> 1234.56
  } else if (s.includes(',')) {
    s = s.replace(',', '.');                        // 1234,56 -> 1234.56
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function buildNotionBody(data) {
  const respNome = (data.responsavel || 'franquelin').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let respPeople = [];
  const added = new Set();
  for (const [key, id] of Object.entries(RESPONSAVEL_MAP)) {
    if (respNome.includes(key) && !added.has(id)) { respPeople.push({ id }); added.add(id); }
  }
  if (respPeople.length === 0) respPeople = [{ id: '826e94f5-aed7-4421-ae97-deee67c6f6af' }];
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
      'Valor': { number: parseValorBR(data.valor) },
      'Atendente': { people: [{ id: ATENDENTE_FIXO }] },
      'Responsável': { people: respPeople },
    },
  };
}

export async function POST(req) {
  const tok = req.headers.get('x-token');
  if (tok !== TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!NOTION_TOKEN) return NextResponse.json({ error: 'NOTION_TOKEN não configurado' }, { status: 500 });

  try {
    const input = await req.json();
    if (!input.descricao) return NextResponse.json({ error: 'descricao obrigatória' }, { status: 400 });

    const body = buildNotionBody(input);
    const r = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (r.status >= 400) {
      return NextResponse.json({ sucesso: false, erro: data.message || `HTTP ${r.status}` }, { status: 502 });
    }
    return NextResponse.json({
      sucesso: true,
      page_id: (data.id || '').replace(/-/g, ''),
      descricao: input.descricao,
      cliente: input.cliente || null,
    });
  } catch (e) {
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 });
  }
}
