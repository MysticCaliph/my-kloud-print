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
  title: 'PrintKloud — Cloud Printing near KUET',
  description:
    'PrintKloud: upload PDFs, pick print options, see instant BDT pricing, and get prints delivered around KUET, Khulna. Pay with your bKash-funded wallet.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
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
