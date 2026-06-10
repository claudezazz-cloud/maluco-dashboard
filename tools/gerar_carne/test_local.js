import { faturarCliente } from './faturar.js';

(async () => {
  const codigo = 'Conceição dos Santos';
  const meses = ["Julho", "Agosto", "Setembro", "Outubro", "Novembro"];
  console.log('Iniciando teste local de faturamento...');
  const res = await faturarCliente(codigo, meses);
  console.log('Resultado do teste:', JSON.stringify(res, null, 2));
})();
