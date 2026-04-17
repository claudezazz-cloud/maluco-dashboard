'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao fazer login')
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-[-30%] left-[-10%] w-[500px] h-[500px] bg-brand/[0.04] rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-5%] w-[400px] h-[400px] bg-brand/[0.03] rounded-full blur-[100px]" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo area */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand/10 border border-brand/20 mb-5 shadow-[0_0_30px_rgba(0,200,83,0.1)]">
            <Zap className="w-7 h-7 text-brand" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">Maluco da IA</h1>
          <p className="text-gray-600 text-sm mt-1.5 tracking-wide">Dashboard de Monitoramento</p>
        </div>

        <form onSubmit={handleLogin} className="glass-raised rounded-2xl p-8 border border-white/[0.06] shadow-2xl shadow-black/40">
          <div className="mb-5">
            <label className="block text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-surface border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20 transition-all placeholder:text-gray-700"
              placeholder="seu@email.com"
            />
          </div>

          <div className="mb-7">
            <label className="block text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-surface border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20 transition-all placeholder:text-gray-700"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="mb-5 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-brand/20 hover:shadow-brand/30 active:scale-[0.98]"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Entrando...
              </span>
            ) : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
