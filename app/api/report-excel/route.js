import ExcelJS from 'exceljs';
import { getRedis } from '@/lib/redis';

const getCategoryStyle = (nome) => {
  const cat = String(nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (cat.includes('modifica')) return { argb: 'FFF4CCCC' }; // Light pink
  if (cat.includes('diverg')) return { argb: 'FFEA9999' }; // Reddish pink
  if (cat.includes('mudanca') || cat.includes('upgrade')) return { argb: 'FFB6D7A8' }; // Light green
  if (cat.includes('instala')) return { argb: 'FF38761D' }; // Dark green
  if (cat.includes('reten')) return { argb: 'FFFF0000' }; // Red
  if (cat.includes('perca') || cat.includes('cancel')) return { argb: 'FF990000' }; // Dark red
  return { argb: 'FFD3D3D3' }; // Default light gray
};

const getCategoryTextColor = (nome) => {
  return { argb: 'FF000000' }; 
};

// Map system topic names to nice display names for the group header
const getTopicoDisplayName = (topico) => {
  const t = String(topico || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (t.includes('modificainstala')) return 'MODIFICAÇÃO DE INSTALAÇÃO';
  if (t.includes('divmudcontrual')) return 'DIVERGÊNCIA';
  if (t.includes('mudancacontratual') || t.includes('upgrade') || t.includes('downgrade')) return 'MUDANÇA CONTRATUAL';
  if (t.includes('instassistida')) return 'INSTALAÇÃO ASSISTIDA';
  if (t.includes('retencaospc')) return 'RETENÇÃO SPC';
  if (t.includes('percadeequip')) return 'PERCA DE EQUIPAMENTOS';
  if (t.includes('cancelamento')) return 'CANCELAMENTO';
  return String(topico || 'OUTROS').toUpperCase();
};

const getNotionStatusStyle = (status) => {
  const s = String(status || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (s.includes('conclui') || s.includes('resolv')) return { argb: 'FFE2EFDA' }; // Light green
  if (s.includes('andamento') || s.includes('fila')) return { argb: 'FFFFF2CC' }; // Light yellow
  if (s.includes('parado') || s.includes('pendent')) return { argb: 'FFFCE4D6' }; // Light red/orange
  return { argb: 'FFFFFFFF' }; // White
};

// ===================== NOTION DETERMINÍSTICO (filtro server-side) =====================
// Quando o relatório do Notion vem com `filtro`, o SERVIDOR consulta o Notion, filtra por
// responsável e monta as categorias — em vez de confiar no LLM, que subcontava e conflava
// nomes (ex.: rotular tarefa do Negos como "Franquelin/Negos"). Match por ID de pessoa (com
// aliases: Russo→Junior, Gester→Negos) + fallback por nome.
const NOTION_TOKEN = process.env.NOTION_TOKEN || '';
const NOTION_DB = process.env.NOTION_DB || 'd54e5911e8af43dfaed8f2893e59f6ef';
const RESP_ALIAS = {
  junior: '60f0907844d04a2e9b56b8917fdfd87e', russo: '60f0907844d04a2e9b56b8917fdfd87e',
  franquelin: '826e94f5aed74421ae97deee67c6f6af', franque: '826e94f5aed74421ae97deee67c6f6af',
  luiz: 'f6b0bba1309e46a99b37d5a18c150a16',
  negos: '7630461fd1894b51a13928043faae78f', nego: '7630461fd1894b51a13928043faae78f', gester: '7630461fd1894b51a13928043faae78f',
  victor: '309d872b594c8150a6550002842c1ef6', vitor: '309d872b594c8150a6550002842c1ef6',
};
const normNome = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// IDs de pessoa do Notion que um nome-de-filtro resolve (via alias).
function filtroIds(nomeFiltro) {
  const nf = normNome(nomeFiltro);
  const prim = nf.split(' ')[0];
  const ids = new Set();
  for (const [alias, id] of Object.entries(RESP_ALIAS)) {
    if (nf === alias || nf.includes(alias) || prim === alias) ids.add(id);
  }
  return ids;
}
// Qual nome-de-filtro a tarefa casa (pra agrupar), ou null se não casa nenhum.
function casaResponsavel(peopleIds, peopleNames, responsaveis) {
  for (const f of responsaveis) {
    const ids = filtroIds(f);
    if (peopleIds.some((id) => ids.has(id))) return f;
    const nf = normNome(f);
    if (peopleNames.some((p) => { const np = normNome(p); return np && (np === nf || np.includes(nf) || nf.includes(np) || np.split(' ')[0] === nf.split(' ')[0]); })) return f;
  }
  return null;
}
// Consulta o Notion (paginado) e monta as categorias agrupadas pelo responsável pedido.
async function buildNotionCategorias(filtro) {
  if (!NOTION_TOKEN) throw new Error('NOTION_TOKEN não configurado no servidor.');
  const status = filtro.status || 'Parado';
  const responsaveis = Array.isArray(filtro.responsaveis) ? filtro.responsaveis.filter(Boolean) : [];
  const base = (status && normNome(status) !== 'todas') ? { filter: { property: 'status', select: { equals: status } } } : {};
  let results = [], cursor = null;
  do {
    const r = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...base, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Notion ${r.status}: ${d.message || ''}`);
    results = results.concat(d.results || []);
    cursor = d.has_more ? d.next_cursor : null;
  } while (cursor);

  const grupos = {};
  const hoje = new Date();
  for (const p of results) {
    const pr = p.properties || {};
    const desc = (pr['Descrição']?.title || []).map((t) => t.plain_text).join('') || '(sem descrição)';
    const cli = (pr['Cliente']?.rich_text || []).map((t) => t.plain_text).join('');
    const st = pr['status']?.select?.name || '';
    const entrega = pr['Entrega']?.date?.start || pr['Data']?.date?.start || '';
    const obs = (pr['Obs']?.rich_text || []).map((t) => t.plain_text).join('');
    const people = pr['Responsável']?.people || [];
    const peopleNames = people.map((pe) => pe.name || pe.id);
    const peopleIds = people.map((pe) => (pe.id || '').replace(/-/g, ''));

    let label;
    if (responsaveis.length) {
      label = casaResponsavel(peopleIds, peopleNames, responsaveis);
      if (!label) continue; // não bate o filtro → fora da planilha
    } else {
      label = peopleNames[0] || 'Sem responsável';
    }
    let tempo = obs;
    if (entrega) {
      const dias = Math.floor((new Date(entrega + 'T00:00:00') - hoje) / 86400000);
      const tag = dias < 0 ? `${-dias}d atrasado` : dias === 0 ? 'vence hoje' : `em ${dias}d`;
      tempo = obs ? `${tag} · ${obs}` : tag;
    }
    (grupos[label] = grupos[label] || []).push({
      tarefa: desc, cliente: cli, responsavel: peopleNames.join(', '), status: st, prazo: entrega, tempo_restante: tempo,
    });
  }
  const ordem = responsaveis.length ? responsaveis : Object.keys(grupos);
  const cats = [];
  for (const label of ordem) if (grupos[label]?.length) cats.push({ nome: label, chamados: grupos[label] });
  for (const [k, v] of Object.entries(grupos)) if (!ordem.includes(k) && v.length) cats.push({ nome: k, chamados: v });
  return cats;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const isNotion = body.fonte === 'notion';
    // DETERMINÍSTICO: com `filtro`, o servidor consulta o Notion e monta as categorias
    // (em vez de confiar no JSON do LLM — fonte de subcount/conflação de responsáveis).
    if (isNotion && body.filtro) {
      body.categorias = await buildNotionCategorias(body.filtro);
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(isNotion ? 'Tarefas Notion' : 'Relatório de Atendimentos', { views: [{ showGridLines: true }] });

    if (isNotion) {
      // NOTION COLUMNS
      worksheet.columns = [
        { header: 'Tarefa / Descrição', key: 'tarefa', width: 60 },
        { header: 'Cliente / Ref', key: 'cliente', width: 35 },
        { header: 'Responsável', key: 'responsavel', width: 20 },
        { header: 'Status', key: 'status', width: 20 },
        { header: 'Prazo', key: 'prazo', width: 18 },
        { header: 'Tempo Restante / Obs', key: 'tempo_restante', width: 25 }
      ];

      // Style the header row (Dark Blue)
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Calibri' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      worksheet.autoFilter = 'A1:F1';

      let currentRow = 2;
      const chamados = (body.categorias || []).flatMap(cat => cat.chamados || []);
      const grouped = {};
      
      // We group by the requested category name (Responsavel or Status) provided by the LLM
      (body.categorias || []).forEach(cat => {
        const groupName = String(cat.nome || 'OUTROS').toUpperCase();
        if (!grouped[groupName]) grouped[groupName] = [];
        grouped[groupName] = grouped[groupName].concat(cat.chamados || []);
      });

      for (const [groupName, items] of Object.entries(grouped)) {
        if (!items.length) continue;
        const catRow = worksheet.getRow(currentRow);
        worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
        const mergedCell = worksheet.getCell(`A${currentRow}`);
        
        mergedCell.value = groupName;
        mergedCell.alignment = { vertical: 'middle', horizontal: 'center' };
        mergedCell.font = { bold: true, name: 'Calibri', color: { argb: 'FF000000' } };
        mergedCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }; // Light Gray
        mergedCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        currentRow++;

        items.forEach(ch => {
          const row = worksheet.getRow(currentRow);
          row.values = {
            tarefa: ch.tarefa || ch.descricao || '',
            cliente: ch.cliente || '',
            responsavel: ch.responsavel || '',
            status: ch.status || '',
            prazo: ch.prazo || ch.agendamento || '',
            tempo_restante: ch.tempo_restante || ''
          };

          const rowBgColor = getNotionStatusStyle(ch.status);

          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: rowBgColor };
            cell.font = { name: 'Calibri', color: { argb: 'FF000000' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            // wrapText: texto longo (descrição/obs/cliente) quebra linha em vez de ser cortado
            cell.alignment = {
              vertical: 'top',
              horizontal: (colNumber === 4 || colNumber === 5) ? 'center' : 'left', // Status, Prazo centralizados
              wrapText: true,
            };
          });
          currentRow++;
        });
      }

    } else {
      // ROUTERBOX COLUMNS
      worksheet.columns = [
        { header: 'Cód.', key: 'id', width: 10 },
        { header: 'Cliente', key: 'cliente', width: 45 },
        { header: 'Endereço', key: 'endereco', width: 40 },
        { header: 'End Nº', key: 'numero', width: 10 },
        { header: 'Tópico', key: 'topico', width: 20 },
        { header: 'Agendamento', key: 'agendamento', width: 22 },
        { header: 'Tempo Restante', key: 'tempo_restante', width: 25 },
        { header: 'Situação OS', key: 'situacao', width: 15 }
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF595959' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Calibri' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      worksheet.autoFilter = 'A1:H1';

      let currentRow = 2;
      let chamados = [];
      
      try {
        const redis = getRedis();
        const data = await redis.get('chamados:data');
        if (data) {
          chamados = JSON.parse(data).chamados || [];
        }
      } catch (err) {
        console.error('[report-excel] Error fetching from Redis:', err);
      }

      // Se não vier do Redis, tenta fallback para o body (legado)
      if (!chamados.length) {
        chamados = (body.categorias || []).flatMap(cat => cat.chamados || []);
      }

      const groupedByTopico = {};
      chamados.forEach(ch => {
        const t = ch.topico || 'OUTROS';
        if (!groupedByTopico[t]) groupedByTopico[t] = [];
        groupedByTopico[t].push(ch);
      });

      for (const [topico, items] of Object.entries(groupedByTopico)) {
        const catRow = worksheet.getRow(currentRow);
        worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
        const mergedCell = worksheet.getCell(`A${currentRow}`);
        
        mergedCell.value = getTopicoDisplayName(topico);
        mergedCell.alignment = { vertical: 'middle', horizontal: 'center' };
        mergedCell.font = { bold: true, name: 'Calibri', color: { argb: 'FF000000' } };
        mergedCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA6A6A6' } }; 
        mergedCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        
        currentRow++;
        const rowBgColor = getCategoryStyle(topico);
        const rowTextColor = getCategoryTextColor(topico);

        items.forEach(ch => {
          const row = worksheet.getRow(currentRow);
          row.values = {
            id: ch.id || '', cliente: ch.cliente || '', endereco: ch.endereco || '', numero: ch.numero || '',
            topico: ch.topico || '-', agendamento: ch.agendamento || '', tempo_restante: ch.tempo_restante || '', situacao: ch.situacao || ''
          };
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: rowBgColor };
            cell.font = { name: 'Calibri', color: rowTextColor };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = {
              vertical: 'top',
              horizontal: (colNumber === 6 || colNumber === 8) ? 'center' : 'left',
              wrapText: true, // endereço/cliente longos quebram linha em vez de cortar
            };
          });
          currentRow++;
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="relatorio.xlsx"'
      }
    });
  } catch (error) {
    console.error('[report-excel] Error:', error?.message || error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
