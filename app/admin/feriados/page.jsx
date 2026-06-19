'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { ArrowLeft, Trash2, Plus, CalendarOff } from 'lucide-react'

const TIPOS = ['nacional', 'estadual', 'municipal', 'facultativo', 'recesso']

export default function FeriadosPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [feriados, setFeriados] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ data: '', descricao: '', tipo: 'municipal' })
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch('/api/auth/me').then(r => (r.ok ? r.json() : null)).then(d => {
      if (!d) { router.push('/login'); return }
      if (d.role !== 'admin') { router.push('/dashboard'); return }
      setUser(d)
      carregar()
    })
  }, [router])

  function carregar() {
    fetch('/api/feriados').then(r => (r.ok ? r.json() : [])).then(d => setFeriados(Array.isArray(d) ? d : []))
  }

  async function adicionar() {
    setErro('')
    if (!form.data || !form.descricao) { setErro('Preencha data e descrição'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/feriados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erro ao salvar')
      setForm({ data: '', descricao: '', tipo: 'municipal' })
      carregar()
    } catch (e) { setErro(e.message) } finally { setLoading(false) }
  }

  async function remover(id) {
    if (!confirm('Remover este feriado?')) return
    await fetch('/api/feriados?id=' + id, { method: 'DELETE' })
    carregar()
  }

  const inputCls = 'w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand'
  const hoje = new Date().toISOString().slice(0, 10)
  const fmtData = (d) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}` }
  const diaSemana = (d) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' })

  return (
    <div className="min-h-screen bg-surface">
      <Navbar user={user} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.push('/admin')} className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CalendarOff className="w-6 h-6 text-brand" /> Feriados / Calendário
            </h1>
            <p className="text-gray-400 text-sm">Dias sem trabalho — o bot não manda relatório, bom dia nem cobrança nessas datas.</p>
          </div>
        </div>

        {/* Adicionar */}
        <div className="bg-surface-raised rounded-xl border border-white/[0.06] p-5 mb-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> Adicionar feriado</h2>
          <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr_140px] gap-3">
            <input type="date" className={inputCls} value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            <input className={inputCls} placeholder="Descrição (ex: Aniversário de Lunardelli)" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            <select className={inputCls} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {erro && <p className="text-red-400 text-xs mt-2">{erro}</p>}
          <button onClick={adicionar} disabled={loading} className="mt-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition">
            {loading ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>

        {/* Lista */}
        <div className="bg-surface-raised rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] text-gray-400 text-xs uppercase tracking-wide">
            Próximos feriados ({feriados.length})
          </div>
          {feriados.length === 0 ? (
            <p className="px-5 py-6 text-gray-500 text-sm">Nenhum feriado cadastrado pra frente.</p>
          ) : feriados.map(f => (
            <div key={f.id} className={`flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] ${f.data === hoje ? 'bg-brand/10' : ''}`}>
              <div className="w-24 shrink-0">
                <div className="text-white text-sm font-medium">{fmtData(f.data)}</div>
                <div className="text-gray-500 text-xs">{diaSemana(f.data)}{f.data === hoje ? ' • hoje' : ''}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm truncate">{f.descricao}</div>
                <span className="text-[10px] uppercase tracking-wide text-gray-500">{f.tipo}</span>
              </div>
              <button onClick={() => remover(f.id)} className="text-gray-500 hover:text-red-400 p-1 transition" title="Remover">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
