'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Navbar({ user }) {
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <nav className="bg-[#1a1a24] border-b border-gray-800 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-white">
            <span className="text-xl">👽</span>
            <span>Maluco da IA</span>
          </Link>
          <div className="flex gap-1">
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
              Dashboard
            </Link>
            {user?.role === 'admin' && (
              <>
                <Link href="/pops" className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                  📋 POPs
                </Link>
                <Link href="/treinamento" className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                  🧠 Treinamento
                </Link>
                <Link href="/system-prompt" className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                  ⚙️ System Prompt
                </Link>
                <Link href="/admin" className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
                  Admin
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{user?.nome || user?.email}</span>
          {user?.role === 'admin' && (
            <span className="text-xs bg-blue-900/50 text-blue-300 border border-blue-900 px-2 py-0.5 rounded">Admin</span>
          )}
          <button onClick={logout} className="text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition">
            Sair
          </button>
        </div>
      </div>
    </nav>
  )
}
