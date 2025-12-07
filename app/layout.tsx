import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'StepDevCode.Tech - Portfolio',
  description: 'Portfolio website với Next.js, TypeScript và animations đẹp mắt - Starfield, Shooting Stars, Glassmorphism',
  keywords: ['portfolio', 'nextjs', 'typescript', 'web developer', 'frontend'],
  authors: [{ name: 'StepDevCode' }],
  openGraph: {
    title: 'StepDevCode.Tech - Portfolio',
    description: 'Portfolio website với Next.js, TypeScript và animations đẹp mắt',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

