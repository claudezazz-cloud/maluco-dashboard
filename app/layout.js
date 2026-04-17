import './globals.css'
import { Outfit, DM_Sans, JetBrains_Mono } from 'next/font/google'

const outfit = Outfit({ subsets: ['latin'], display: 'swap', variable: '--font-outfit' })
const dmSans = DM_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-dm-sans' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-mono' })

export const metadata = {
  title: 'Maluco da IA - Dashboard',
  description: 'Dashboard de monitoramento do assistente',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={`${outfit.variable} ${dmSans.variable} ${jetbrains.variable} font-sans min-h-screen text-gray-200 antialiased relative bg-[#08080c]`}>
        {/* Layered background */}
        <div className="fixed inset-0 z-[-2] bg-[#08080c]" />
        <div className="fixed inset-0 z-[-1] bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(0,128,0,0.08),transparent)]" />
        <div className="fixed inset-0 z-[-1] noise-overlay" />

        <div className="flex flex-col min-h-screen">
          <div className="flex-1 relative z-10">{children}</div>

          <footer className="border-t border-white/[0.04] bg-[#08080c]/80 backdrop-blur-xl py-4 px-6 text-center relative z-10">
            <p className="text-[11px] text-gray-600 tracking-wide">
              Desenvolvido por <span className="text-gray-500 font-medium">Franquelin Baldoria de Almeida</span>
              <span className="mx-2 text-gray-700">|</span>
              <a href="https://instagram.com/Frank_almeida5" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors duration-300">@Frank_almeida5</a>
              <span className="mx-2 text-gray-700">|</span>
              <a href="https://wa.me/5543991663335" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors duration-300">(43) 99166-3335</a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  )
}
