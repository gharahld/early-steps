import './globals.css'
import { Providers } from './providers.jsx'

export const metadata = {
  title: 'Early Steps Provider Portal',
  description: 'Broward Early Steps therapy provider invoice portal',
  icons: { icon: '/favicon.svg' },
  robots: { index: false, follow: false },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0f172a',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
