'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { DollarSign, Cpu, TrendingDown, RefreshCw } from 'lucide-react'

const fmt = (n) => Number(n || 0).toLocaleString('pt-BR')

export default function CustosPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me').then(r => { if (!r.ok) { router.push('/login'); return null } return r.json() })
      .then(d => { if (d) setUser(d.user || d) })
  }, [router])

  useEffect(() => {
    if (!user) return
    fetch('/api/custos').then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [user])

  if (!user) return null
  const maxTok = data?.dias?.length ? Math.max(...data.dias.map(d => d.tokens), 1) : 1

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f13', color: '#e5e7eb' }}>
      <Navbar user={user} />
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <DollarSign size={24} color="#22c55e" />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Custos da IA</h1>
        </div>
        <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 0, marginBottom: 20 }}>
          Quanto o bot consome em tokens (e quanto isso custa, estimado). Os tokens são exatos; o valor em R$ é uma estimativa assumindo Claude {data?.rates?.modelo?.replace(' (estimativa)', '') || 'Haiku'}.
        </p>

        {loading || !data ? (
          <div style={{ display: 'flex', gap: 8, color: '#9ca3af', padding: 20 }}><RefreshCw size={16} className="spin" /> Carregando…</div>
        ) : data.error ? (
          <div style={{ color: '#ef4444', padding: 20 }}>Erro: {data.error}</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 20 }}>
              <Card titulo="Hoje" icon={<Cpu size={16} color="#93c5fd" />}>
                <Big>{fmt(data.hoje.tokens_input + data.hoje.tokens_output)} <span style={{ fontSize: 13, color: '#6b7280' }}>tokens</span></Big>
                <Sub>{data.hoje.msgs} mensagens · ~US$ {data.hoje.custo.usd} (R$ {data.hoje.custo.brl})</Sub>
              </Card>
              <Card titulo="Este mês" icon={<Cpu size={16} color="#93c5fd" />}>
                <Big>{fmt(data.mes.tokens_input + data.mes.tokens_output)} <span style={{ fontSize: 13, color: '#6b7280' }}>tokens</span></Big>
                <Sub>{data.mes.msgs} mensagens · média {fmt(data.mes.media_tokens_msg)} tok/msg</Sub>
              </Card>
              <Card titulo="Custo estimado (mês)" icon={<DollarSign size={16} color="#22c55e" />} destaque>
                <Big style={{ color: '#22c55e' }}>R$ {data.mes.custo.brl}</Big>
                <Sub>≈ US$ {data.mes.custo.usd} · estimativa</Sub>
              </Card>
            </div>

            <div style={{ background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 12 }}>Últimos 14 dias</div>
              {data.dias.length === 0 ? <div style={{ color: '#6b7280', fontSize: 13 }}>Sem dados.</div> : data.dias.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                  <span style={{ width: 44, fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>{d.dia}</span>
                  <div style={{ flex: 1, background: '#0f0f13', borderRadius: 6, height: 18, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(2, (d.tokens / maxTok) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#071DE3,#3b82f6)', borderRadius: 6 }} />
                  </div>
                  <span style={{ width: 90, fontSize: 12, color: '#cbd5e1', textAlign: 'right' }}>{fmt(d.tokens)}</span>
                  <span style={{ width: 70, fontSize: 11, color: '#6b7280', textAlign: 'right' }}>R$ {d.custo.brl}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#0c1f17', border: '1px solid #14532d', borderRadius: 10, padding: '12px 14px' }}>
              <TrendingDown size={18} color="#22c55e" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12.5, color: '#a7f3d0', lineHeight: 1.5 }}>
                <b>Otimização de 22/06:</b> ligamos o cache do prompt e enxugamos o contexto. Uma mensagem simples caiu de ~6.000 para ~325 tokens, e uma pergunta com ferramenta de ~20.000 para ~1.500 — cerca de <b>90% mais barato</b> no dia a dia. As médias antigas (acima) ainda misturam o período caro.
              </div>
            </div>
            <p style={{ fontSize: 11, color: '#4b5563', marginTop: 12 }}>
              Estimativa com {data.rates.modelo}: US$ {data.rates.in_usd_milhao}/mi (entrada) e US$ {data.rates.out_usd_milhao}/mi (saída), câmbio R$ {data.rates.usd_brl}. Mensagens de tarefa/carnê podem usar um modelo mais caro (Sonnet), então o custo real pode ser um pouco maior.
            </p>
          </>
        )}
      </div>
      <style jsx>{`.spin { animation: spin 1s linear infinite } @keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function Card({ titulo, icon, children, destaque }) {
  return (
    <div style={{ background: destaque ? '#0c1f17' : '#1a1a24', border: `1px solid ${destaque ? '#14532d' : '#2a2a38'}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>{icon}{titulo}</div>
      {children}
    </div>
  )
}
const Big = ({ children, style }) => <div style={{ fontSize: 24, fontWeight: 700, ...style }}>{children}</div>
const Sub = ({ children }) => <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{children}</div>
