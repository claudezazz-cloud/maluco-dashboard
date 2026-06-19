import { query } from './db'

// Retorna a linha do feriado { data, descricao, tipo } se HOJE (horário de São Paulo)
// estiver na tabela, senão null. Fail-safe: erro de banco → null.
export async function feriadoHoje() {
  try {
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()) // YYYY-MM-DD
    const r = await query('SELECT to_char(data,\'YYYY-MM-DD\') AS data, descricao, tipo FROM feriados WHERE data = $1', [hoje])
    return r.rows[0] || null
  } catch {
    return null
  }
}

// Expediente da equipe (BRT): seg-sex dia todo; SÁBADO trabalha até 12h (manhã liberada,
// inclusive antes das 09h; só NÃO dispara à TARDE, das 12h em diante); domingo nunca.
// Recebe `now` (default = agora) só pra facilitar testes. Retorna {motivo, detalhe}
// se estiver FORA do expediente por dia/hora (não cobre feriado — ver foraDeExpediente).
export function janelaForaExpediente(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', hour12: false })
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]))
  const wd = parts.weekday // 'Sun','Mon',...,'Sat'
  const hour = parseInt(parts.hour, 10)
  if (wd === 'Sun') return { motivo: 'domingo', detalhe: 'domingo (sem expediente)' }
  if (wd === 'Sat' && hour >= 12) return { motivo: 'sabado_tarde', detalhe: 'sábado à tarde (equipe trabalha só até 12h)' }
  return null
}

// Combina feriado + janela de expediente. Retorna {motivo, detalhe} se o bot NÃO deve
// disparar mensagens da equipe agora, senão null. Fail-safe embutido no feriadoHoje().
export async function foraDeExpediente(now = new Date()) {
  const fer = await feriadoHoje()
  if (fer) return { motivo: 'feriado', detalhe: fer.descricao }
  return janelaForaExpediente(now)
}
