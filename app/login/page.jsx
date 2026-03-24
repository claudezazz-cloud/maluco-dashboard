'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f13]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">👽🍀</div>
          <h1 className="text-2xl font-bold text-white">Maluco da IA</h1>
          <p className="text-gray-400 text-sm mt-1">Dashboard de Monitoramento</p>
        </div>

        <form onSubmit={handleLogin} className="bg-[#1a1a24] rounded-2xl p-8 shadow-xl border border-gray-800">
          <div className="mb-5">
            <label className="block text-sm text-gray-400 mb-2">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-[#0f0f13] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#071DE3] transition"
              placeholder="seu@email.com"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-[#0f0f13] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#071DE3] transition"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="mb-4 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#071DE3] hover:bg-[#0516B0] disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
