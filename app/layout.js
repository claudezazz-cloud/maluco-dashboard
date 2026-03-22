import './globals.css'

export const metadata = {
  title: 'Maluco da IA 👽 - Dashboard',
  description: 'Dashboard de monitoramento do assistente',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
