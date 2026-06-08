import ExcelJS from 'exceljs';

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

export async function POST(req) {
  try {
    const body = await req.json();
    const isNotion = body.fonte === 'notion';
    
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
            if (colNumber === 4 || colNumber === 5) {
              cell.alignment = { vertical: 'middle', horizontal: 'center' }; // Status, Prazo
            } else {
              cell.alignment = { vertical: 'middle', horizontal: 'left' };
            }
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
      const chamados = (body.categorias || []).flatMap(cat => cat.chamados || []);
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
            if (colNumber === 6 || colNumber === 8) cell.alignment = { vertical: 'middle', horizontal: 'center' };
            else cell.alignment = { vertical: 'middle', horizontal: 'left' };
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
