'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { Users, Search, ChevronDown, ChevronRight, Brain, RefreshCw } from 'lucide-react'

const CAT_COR = {
  problema: '#ef4444', venda: '#22c55e', processo: '#3b82f6',
  preferencia: '#a855f7', financeiro: '#f59e0b', contexto: '#64748b',
}

export default function ClientesPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [q, setQ] = useState('')
  const [busca, setBusca] = useState('')        // termo efetivamente buscado
  const [comHistorico, setComHistorico] = useState(false)
  const [data, setData] = useState({ clientes: [], total: 0, page: 0, hasMore: false })
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) { router.push('/login'); return null }
      return r.json()
    }).then(d => { if (d) setUser(d.user || d) })
  }, [router])

  const carregar = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ q: busca, page: String(page), comHistorico: comHistorico ? '1' : '0' })
    fetch('/api/clientes/lista?' + params)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [busca, page, comHistorico])

  useEffect(() => { if (user) carregar() }, [user, carregar])

  function submitBusca(e) {
    e?.preventDefault()
    setPage(0)
    setBusca(q.trim())
  }

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f13', color: '#e5e7eb' }}>
      <Navbar user={user} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Users size={24} color="#071DE3" />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Clientes</h1>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: '#9ca3af' }}>
            {data.total} cliente(s){busca ? ` para "${busca}"` : ''}
          </span>
        </div>
        <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 0, marginBottom: 16 }}>
          Base de clientes da Zazz + o histórico que o bot foi aprendendo de cada um (problemas, vendas, preferências).
          O bot puxa esse histórico sob demanda pela ferramenta <code style={{ color: '#93c5fd' }}>historico_cliente</code>.
        </p>

        <form onSubmit={submitBusca} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} color="#6b7280" style={{ position: 'absolute', left: 10, top: 11 }} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Nome do cliente, código ou parte do nome…"
              style={{ width: '100%', padding: '9px 12px 9px 32px', background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: 8, color: '#e5e7eb', fontSize: 14 }}
            />
          </div>
          <button type="submit" style={{ padding: '9px 18px', background: '#071DE3', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Buscar</button>
        </form>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1', marginBottom: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={comHistorico} onChange={e => { setComHistorico(e.target.checked); setPage(0) }} />
          Mostrar só clientes que já têm histórico
        </label>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9ca3af', padding: 20 }}>
            <RefreshCw size={16} className="spin" /> Carregando…
          </div>
        ) : data.clientes.length === 0 ? (
          <div style={{ color: '#9ca3af', padding: 20, textAlign: 'center' }}>Nenhum cliente encontrado.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.clientes.map(c => {
              const aberto = expandido === c.cod
              return (
                <div key={c.cod} style={{ background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: 10, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandido(aberto ? null : c.cod)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'none', border: 'none', color: '#e5e7eb', cursor: 'pointer', textAlign: 'left' }}
                  >
                    {aberto ? <ChevronDown size={16} color="#6b7280" /> : <ChevronRight size={16} color="#6b7280" />}
                    <span style={{ fontFamily: 'monospace', color: '#6b7280', fontSize: 13, minWidth: 56, flexShrink: 0 }}>{c.cod}</span>
                    <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</span>
                      {c.cpf && <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>{c.cpf}</span>}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {c.grupo && <span style={{ fontSize: 11, color: '#a5b4fc', background: '#1e1b4b', padding: '2px 8px', borderRadius: 6 }}>{c.grupo}</span>}
                      {c.n_fatos > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#93c5fd', background: '#071de31a', padding: '2px 9px', borderRadius: 20 }}>
                          <Brain size={12} /> {c.n_fatos}
                        </span>
                      )}
                    </span>
                  </button>
                  {aberto && (
                    <div style={{ padding: '0 14px 14px 40px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {c.fatos.length === 0 ? (
                        <span style={{ fontSize: 13, color: '#6b7280', fontStyle: 'italic' }}>Sem histórico registrado ainda.</span>
                      ) : c.fatos.map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, lineHeight: 1.4 }}>
                          <span style={{ marginTop: 5, width: 7, height: 7, borderRadius: '50%', background: CAT_COR[f.categoria] || '#64748b', flexShrink: 0 }} />
                          <span>
                            {f.fato}
                            <span style={{ color: '#6b7280', marginLeft: 6, fontSize: 11 }}>
                              {f.categoria ? `· ${f.categoria}` : ''}{f.ocorrencias > 1 ? ` · ${f.ocorrencias}x` : ''}{f.ultima ? ` · ${f.ultima}` : ''}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {(page > 0 || data.hasMore) && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
            <button disabled={page === 0} onClick={() => { setExpandido(null); setPage(p => Math.max(0, p - 1)) }}
              style={{ padding: '7px 16px', background: page === 0 ? '#1a1a24' : '#2a2a38', border: '1px solid #2a2a38', borderRadius: 8, color: page === 0 ? '#4b5563' : '#e5e7eb', cursor: page === 0 ? 'default' : 'pointer' }}>← Anterior</button>
            <span style={{ fontSize: 13, color: '#9ca3af' }}>página {page + 1}</span>
            <button disabled={!data.hasMore} onClick={() => { setExpandido(null); setPage(p => p + 1) }}
              style={{ padding: '7px 16px', background: !data.hasMore ? '#1a1a24' : '#2a2a38', border: '1px solid #2a2a38', borderRadius: 8, color: !data.hasMore ? '#4b5563' : '#e5e7eb', cursor: !data.hasMore ? 'default' : 'pointer' }}>Próxima →</button>
          </div>
        )}
      </div>
      <style jsx>{`.spin { animation: spin 1s linear infinite } @keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
