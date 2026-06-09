import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'Florida Builder Deal Finder',
    template: '%s | Florida Builder Deal Finder',
  },
  description:
    'Identify the best land acquisition and development opportunities on Florida\'s east coast.',
  keywords: ['Florida', 'land', 'real estate', 'development', 'builder', 'deal finder'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="h-full bg-slate-900 text-slate-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
