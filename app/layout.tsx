import SupabaseProvider from '@/components/providers/supabase-provider'
import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Credit Card Dashboard',
  description: 'A dashboard for managing your credit cards.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  )
}