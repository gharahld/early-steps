import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}
