import { NextResponse } from 'next/server';
import { faturarCliente } from '../../../../tools/gerar_carne/faturar.js';

const TOKEN = process.env.MALUCO_INTERNAL_TOKEN || 'MALUCO_POPS_2026';

export async function POST(req) {
  const tok = req.headers.get('x-token');
  if (tok !== TOKEN) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const codigo_cliente = body.codigo_cliente || body.codigoCliente || body.codigo;
    
    // Meses padrão se não informado
    let meses = body.meses;
    if (!meses || !Array.isArray(meses) || meses.length === 0) {
      const todosMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      const mesAtual = new Date().getMonth();
      meses = todosMeses.slice(mesAtual);
    }

    if (!codigo_cliente) {
      return NextResponse.json({ error: 'codigo_cliente é obrigatório' }, { status: 400 });
    }

    // Como o Playwright pode ser lento, vamos rodar e retornar depois.
    // O Next.js não tem problema com rotas longas se rodarmos local, mas o proxy
    // do N8N ou Nginx pode dar timeout.
    // Se der timeout, ideal seria webhook, mas conforme prompt, retornamos a resposta HTTP sincrona.
    const resultado = await faturarCliente(codigo_cliente.toString(), meses);

    return NextResponse.json(resultado);
  } catch (e) {
    console.error('[POST /api/tools/gerar_carne] Error:', e);
    return NextResponse.json({ sucesso: false, erro: e.message }, { status: 500 });
  }
}
