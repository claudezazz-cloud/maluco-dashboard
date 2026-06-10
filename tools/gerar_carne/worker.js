import { faturarCliente } from './faturar.js';

(async () => {
  const cliente = process.argv[2];
  const mesesRaw = process.argv[3];
  
  if (!cliente || !mesesRaw) {
    console.log(JSON.stringify({ sucesso: false, mensagem: "Parâmetros cliente ou meses faltando." }));
    process.exit(1);
  }
  
  const meses = mesesRaw.split(',').map(m => m.trim());
  
  try {
    const res = await faturarCliente(cliente, meses);
    console.log(JSON.stringify(res));
    process.exit(0);
  } catch (err) {
    console.log(JSON.stringify({ sucesso: false, erro: err.message }));
    process.exit(1);
  }
})();
