import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  metadataBase: new URL('https://www.rehubber.com'),
  title: {
    default: 'Rehubber — Open Source Developer Tools Directory',
    template: '%s · Rehubber',
  },
  description:
    'Discover open source tools updated daily. Ranked by the community, over 600 listed across all categories.',
  openGraph: {
    title: 'Rehubber — Open Source Developer Tools Directory',
    description:
      'Discover open source tools updated daily. Ranked by the community, over 600 listed across all categories.',
    url: 'https://www.rehubber.com',
    siteName: 'Rehubber',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rehubber — Open Source Developer Tools Directory',
    description:
      'Discover open source tools updated daily. Ranked by the community, over 600 listed across all categories.',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#1b1d22',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} bg-background`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `if(typeof window!=='undefined'&&window.location.hostname==='rehubber.com'){window.location.replace('https://www.rehubber.com'+window.location.pathname+window.location.search+window.location.hash);}`,
          }}
        />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  )
}
