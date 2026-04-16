import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata = {
  title: 'Maluco da IA 👽 - Dashboard',
  description: 'Dashboard de monitoramento do assistente',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} min-h-screen text-gray-200 antialiased relative bg-black`}>
        {/* Fundo Dinâmico com Radial Gradient */}
        <div className="fixed inset-0 z-[-1] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-[#0f0f13] to-black"></div>
        
        <div className="flex flex-col min-h-screen">
          <div className="flex-1 relative z-10">{children}</div>
          
          <footer className="border-t border-gray-800/40 bg-[#0f0f13]/60 backdrop-blur-md py-3 px-6 text-center relative z-10">
            <p className="text-xs text-gray-500">
              Desenvolvido por <span className="text-gray-400 font-medium">Franquelin Baldoria de Almeida</span>
              {' · '}
              <a href="https://instagram.com/Frank_almeida5" target="_blank" rel="noopener noreferrer" className="hover:text-green-400 hover:glow-sm transition-all duration-300">@Frank_almeida5</a>
              {' · '}
              <a href="https://wa.me/5543991663335" target="_blank" rel="noopener noreferrer" className="hover:text-green-400 hover:glow-sm transition-all duration-300">WhatsApp: (43) 99166-3335</a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  )
}
