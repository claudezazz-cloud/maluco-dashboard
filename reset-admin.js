const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// A URL do banco será pega da variável de ambiente PG_URL
const PG_URL = process.env.PG_URL;

if (!PG_URL) {
  console.error('ERRO: Variável PG_URL não encontrada. Use: PG_URL="url" node reset-admin.js');
  process.exit(1);
}

const pool = new Pool({ connectionString: PG_URL });

async function reset() {
  const email = 'admin@maluco.ia'; // E-mail padrão do admin
  const novaSenha = 'admin123';     // Senha padrão para reset
  
  console.log(`Tentando resetar senha para: ${email}...`);
  
  try {
    const hash = await bcrypt.hash(novaSenha, 10);
    const res = await pool.query(
      'UPDATE dashboard_usuarios SET senha_hash = $1 WHERE email = $2 RETURNING id, nome',
      [hash, email]
    );
    
    if (res.rowCount > 0) {
      console.log('--------------------------------------------------');
      console.log(`SUCESSO!`);
      console.log(`Usuário: ${res.rows[0].nome} (${email})`);
      console.log(`Nova Senha: ${novaSenha}`);
      console.log('--------------------------------------------------');
      console.log('IMPORTANTE: Apague este arquivo após o uso por segurança.');
    } else {
      console.log(`ERRO: Usuário com e-mail ${email} não foi encontrado no banco.`);
      console.log('Verifique se o e-mail está correto no script.');
    }
  } catch (err) {
    console.error('ERRO CRÍTICO ao acessar o banco:', err.message);
  } finally {
    await pool.end();
  }
}

reset();
