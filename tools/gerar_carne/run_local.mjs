// Runner local do faturamento — roda do PC (IP residencial), navegador visível.
// Uso:
//   RB_USER=... RB_PASS=... RB_HEADLESS=false node run_local.mjs <codigo> <mes1,mes2,...>
import { faturarCliente } from './faturar.js';

const codigo = process.argv[2] || '13543';
const mesesArg = process.argv[3] || 'Junho,Julho,Agosto,Setembro,Outubro,Novembro';
const meses = mesesArg.split(',').map(m => m.trim());

console.log(`\n=== FATURAMENTO LOCAL ===`);
console.log(`Cliente: ${codigo}`);
console.log(`Meses: ${meses.join(', ')}`);
console.log(`Conta RB: ${process.env.RB_USER}`);
console.log(`Headless: ${process.env.RB_HEADLESS !== 'false'}`);
console.log(`=========================\n`);

const t0 = Date.now();
const resultado = await faturarCliente(codigo, meses);
const dur = Math.round((Date.now() - t0) / 1000);

console.log(`\n=== RESULTADO (${dur}s) ===`);
console.log(JSON.stringify(resultado, null, 2));
if (resultado.video) console.log(`\n🎥 Vídeo do processo: ${resultado.video}`);
process.exit(resultado.sucesso ? 0 : 1);
