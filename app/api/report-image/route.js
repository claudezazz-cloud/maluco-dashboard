import { ImageResponse } from 'next/og';

// Color map for common topic types
const TOPICO_COLORS = {
  'modificainstala': '#ef4444',
  'percadeequip': '#ef4444',
  'retencaospc': '#ef4444',
  'divmudcontrual': '#ef4444',
  'cancelamento': '#ef4444',
  'mudancaendereco': '#f59e0b',
  'upgrade': '#22c55e',
  'downgrade': '#f59e0b',
  'instalacao': '#3b82f6',
  'internet': '#3b82f6',
  'contrato': '#a855f7',
  'contratos': '#a855f7',
  'grafica': '#ec4899',
  'designer': '#ec4899',
  'outros': '#64748b',
  'default': '#f97316'
};

function getTopicoColor(topico) {
  if (!topico) return TOPICO_COLORS.default;
  const key = topico.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f\s]/g, '');
  for (const [k, v] of Object.entries(TOPICO_COLORS)) {
    if (key.includes(k)) return v;
  }
  return TOPICO_COLORS.default;
}

export async function POST(req) {
  try {
    const body = await req.json();
    
    const allRows = (body.categorias || []).flatMap(cat =>
      (cat.chamados || []).map(ch => ({ ...ch, categoria: cat.nome }))
    );
    const height = Math.max(350, 260 + (allRows.length * 56));

    // Check if any row has topico
    const hasTopico = allRows.some(item => item.topico);

    // Sanitize data
    const rows = allRows.map((item, idx) => {
      let id = String(item.id || '-');
      if (id.length > 8) id = '#' + id.substring(0, 6);
      
      let cliente = String(item.cliente || '-').substring(0, 30);
      
      let categoria = String(item.categoria || '-');
      if (categoria.includes(' — ')) categoria = categoria.split(' — ')[0];
      if (categoria.includes(' - ')) categoria = categoria.split(' - ')[0];
      
      let topico = item.topico ? String(item.topico).substring(0, 20) : '';
      
      let dias = Number(item.dias || 0);

      return {
        id,
        cliente,
        categoria,
        topico,
        topicoColor: getTopicoColor(topico),
        dias,
        bg: idx % 2 === 0 ? '#0f172a' : '#1e293b',
        diasColor: dias > 30 ? '#f87171' : dias > 7 ? '#fbbf24' : '#94a3b8'
      };
    });

    // Column widths adapt based on whether topico exists
    const cols = hasTopico
      ? { os: '8%', cliente: '30%', categoria: '20%', topico: '22%', tempo: '20%' }
      : { os: '10%', cliente: '42%', categoria: '26%', topico: '0%', tempo: '22%' };

    return new ImageResponse(
      (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#0f172a', padding: '40px', fontFamily: 'sans-serif' }}>
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '20px', borderBottom: '2px solid #1e293b' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: '42px', fontWeight: 700, color: '#34d399' }}>Zazz Internet</div>
              <div style={{ display: 'flex', fontSize: '20px', color: '#94a3b8', marginTop: '4px' }}>{String(body.data || 'Hoje')}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: '10px', padding: '12px 24px', marginLeft: '16px' }}>
                <div style={{ display: 'flex', fontSize: '14px', color: '#94a3b8' }}>Total</div>
                <div style={{ display: 'flex', fontSize: '28px', fontWeight: 700, color: '#f1f5f9' }}>{String(body.total || 0)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: '10px', padding: '12px 24px', marginLeft: '16px' }}>
                <div style={{ display: 'flex', fontSize: '14px', color: '#94a3b8' }}>OK</div>
                <div style={{ display: 'flex', fontSize: '28px', fontWeight: 700, color: '#34d399' }}>{String(body.concluidos || 0)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: '10px', padding: '12px 24px', marginLeft: '16px' }}>
                <div style={{ display: 'flex', fontSize: '14px', color: '#94a3b8' }}>Pendente</div>
                <div style={{ display: 'flex', fontSize: '28px', fontWeight: 700, color: '#f87171' }}>{String(body.pendentes || 0)}</div>
              </div>
            </div>
          </div>
          {/* Table Header */}
          <div style={{ display: 'flex', flexDirection: 'row', backgroundColor: '#1e293b', padding: '12px 20px', borderRadius: '8px 8px 0 0' }}>
            <div style={{ display: 'flex', width: cols.os, fontSize: '14px', fontWeight: 700, color: '#64748b' }}>OS</div>
            <div style={{ display: 'flex', width: cols.cliente, fontSize: '14px', fontWeight: 700, color: '#64748b' }}>Cliente</div>
            <div style={{ display: 'flex', width: cols.categoria, fontSize: '14px', fontWeight: 700, color: '#64748b' }}>Categoria</div>
            {hasTopico && (
              <div style={{ display: 'flex', width: cols.topico, fontSize: '14px', fontWeight: 700, color: '#64748b' }}>Topico</div>
            )}
            <div style={{ display: 'flex', width: cols.tempo, fontSize: '14px', fontWeight: 700, color: '#64748b', justifyContent: 'flex-end' }}>Tempo</div>
          </div>
          {/* Table Body */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.length === 0 ? (
              <div style={{ display: 'flex', padding: '20px', justifyContent: 'center', color: '#64748b', fontSize: '16px' }}>Nenhum item.</div>
            ) : (
              rows.map((r, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'row', padding: '12px 20px', backgroundColor: r.bg, borderBottom: '1px solid #1e293b', alignItems: 'center' }}>
                  <div style={{ display: 'flex', width: cols.os, fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>{r.id}</div>
                  <div style={{ display: 'flex', width: cols.cliente, fontSize: '15px', color: '#cbd5e1' }}>{r.cliente}</div>
                  <div style={{ display: 'flex', width: cols.categoria, fontSize: '13px', color: '#34d399' }}>{r.categoria}</div>
                  {hasTopico && (
                    <div style={{ display: 'flex', width: cols.topico }}>
                      {r.topico ? (
                        <div style={{ display: 'flex', backgroundColor: r.topicoColor + '20', borderLeft: '3px solid ' + r.topicoColor, padding: '4px 10px', borderRadius: '0 6px 6px 0', fontSize: '12px', fontWeight: 600, color: r.topicoColor }}>{r.topico}</div>
                      ) : (
                        <div style={{ display: 'flex', fontSize: '13px', color: '#475569' }}>-</div>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', width: cols.tempo, fontSize: '16px', fontWeight: 700, color: r.diasColor, justifyContent: 'flex-end' }}>{String(r.dias) + (r.dias === 1 ? ' dia' : ' dias')}</div>
                </div>
              ))
            )}
          </div>
        </div>
      ),
      { width: 1200, height }
    );
  } catch (error) {
    console.error('[report-image] Error:', error?.message || error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
