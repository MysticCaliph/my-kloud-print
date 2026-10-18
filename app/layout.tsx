import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Hind_Siliguri } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
// Geist lacks the Taka sign (৳), so a Bengali font supplies it as a fallback.
const bengali = Hind_Siliguri({
  subsets: ['bengali'],
  weight: ['500', '600'],
  variable: '--font-bengali',
})

export const metadata: Metadata = {
  title: 'PrintKloud | Cloud Printing Service',
  description: 'Fast, secure cloud printing and local hand-to-hand delivery.',
  metadataBase: new URL('https://www.printkloud.me'),
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#14161c',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable} ${bengali.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
