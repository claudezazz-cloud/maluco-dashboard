import { NextResponse } from 'next/server'
import { query, withTransaction } from '@/lib/db'

// POST /api/clientes/auto-import
// Recebe o Excel de clientes do Routerbox (cons_clientes_geral) JÁ PARSEADO pelo scraper
// routerbox-auto/scrape_clientes.js, no formato { headers: [...], clientes: [ [row], ... ] }.
// Mapeia Cód / CPF/CNPJ / Nome / Grupo e faz refresh completo de dashboard_clientes.
// Token-protected (sem sessão) pro scraper consumir — mesmo token dos chamados.
const TOKEN = process.env.CHAMADOS_AUTO_TOKEN || 'CHAMADOS_AUTO_2026'

const norm = (h) => String(h || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS dashboard_clientes (
      id SERIAL PRIMARY KEY,
      cod VARCHAR(50) NOT NULL,
      nome VARCHAR(500) NOT NULL,
      ativo BOOLEAN DEFAULT true,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `)
  await query(`ALTER TABLE dashboard_clientes ADD COLUMN IF NOT EXISTS cpf VARCHAR(25)`)
  await query(`ALTER TABLE dashboard_clientes ADD COLUMN IF NOT EXISTS grupo VARCHAR(30)`)
}

export async function POST(req) {
  if (req.headers.get('x-auto-token') !== TOKEN) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const { headers, clientes: rows } = await req.json()
    if (!Array.isArray(headers) || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Payload inválido (headers/clientes)' }, { status: 400 })
    }

    // Acha o índice de cada coluna que interessa
    const idx = { cod: -1, cpf: -1, nome: -1, grupo: -1 }
    headers.forEach((h, i) => {
      const n = norm(h)
      if (idx.cod < 0 && (n === 'cod' || n === 'codigo')) idx.cod = i
      else if (idx.cpf < 0 && (n === 'cpf/cnpj' || n === 'cpf' || n === 'cnpj')) idx.cpf = i
      else if (idx.nome < 0 && n === 'nome') idx.nome = i
      else if (idx.grupo < 0 && n === 'grupo') idx.grupo = i
    })
    if (idx.cod < 0 || idx.nome < 0) {
      return NextResponse.json({ error: 'Colunas Cód/Nome não encontradas no Excel', headers }, { status: 400 })
    }

    const clientes = []
    const vistos = new Set()
    for (const row of rows) {
      const cod = String(row[idx.cod] ?? '').trim()
      const nome = String(row[idx.nome] ?? '').trim()
      if (!cod || !nome) continue
      if (vistos.has(cod)) continue
      vistos.add(cod)
      clientes.push({
        cod,
        nome,
        cpf: idx.cpf >= 0 ? String(row[idx.cpf] ?? '').trim() : '',
        grupo: idx.grupo >= 0 ? String(row[idx.grupo] ?? '').trim() : '',
      })
    }
    if (clientes.length === 0) {
      return NextResponse.json({ error: 'Nenhum cliente válido após o parse' }, { status: 400 })
    }

    await ensureTable()
    const textoBot = clientes.map(c => `${c.nome}\t${c.cod}`).join('\n')
    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const BATCH = 100

    await withTransaction(async (qt) => {
      await qt('DELETE FROM dashboard_clientes')
      for (let i = 0; i < clientes.length; i += BATCH) {
        const batch = clientes.slice(i, i + BATCH)
        const vals = []
        const params = []
        batch.forEach((c, k) => {
          const o = k * 4
          vals.push(`($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4})`)
          params.push(c.cod, c.nome, c.cpf || null, c.grupo || null)
        })
        await qt(`INSERT INTO dashboard_clientes (cod, nome, cpf, grupo) VALUES ${vals.join(', ')}`, params)
      }
      await qt(
        `INSERT INTO dashboard_config (chave, valor, atualizado_em) VALUES ('clientes_importado_em', $1, NOW())
         ON CONFLICT (chave) DO UPDATE SET valor = $1, atualizado_em = NOW()`,
        [agora]
      )
      await qt(
        `INSERT INTO dashboard_config (chave, valor, atualizado_em) VALUES ('clientes_texto', $1, NOW())
         ON CONFLICT (chave) DO UPDATE SET valor = $1, atualizado_em = NOW()`,
        [textoBot]
      )
    })

    return NextResponse.json({ ok: true, total: clientes.length, importado_em: agora, com_cpf: clientes.filter(c => c.cpf).length, com_grupo: clientes.filter(c => c.grupo).length })
  } catch (e) {
    console.error('POST /api/clientes/auto-import:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
