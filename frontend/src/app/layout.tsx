import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ClerkProvider } from '@clerk/nextjs'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'GuideKit — Developer Admin Portal',
  description: 'IDE-to-DOM self-healing product tours for modern web apps',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body style={{ margin: 0 }}>
        <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
          <AuthProvider>{children}</AuthProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
