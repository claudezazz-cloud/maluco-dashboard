import { NextResponse } from 'next/server';

// ⚠️ ROTA DESATIVADA (17/06/2026). Era o caminho SÍNCRONO antigo do carnê: recebia
// { cliente, meses } e executava o worker.js DIRETO, SEM o guard anti-cliente-errado
// (validação código↔nome) que hoje vive no /api/fila/enqueue. Como era um bypass do guard
// e nada mais a chama (o bot usa a fila), foi desativada pra fechar o buraco financeiro.
// Mantida como lápide. Todo faturamento passa por POST /api/fila/enqueue.
const MSG = 'Rota /api/faturar desativada. Faturamento é só pela fila: POST /api/fila/enqueue (com validação de cliente).';

export async function POST() {
  return NextResponse.json({ error: MSG }, { status: 410 });
}

export async function GET() {
  return NextResponse.json({ error: MSG }, { status: 410 });
}
