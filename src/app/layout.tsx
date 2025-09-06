import React from 'react'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PodcastFlow Pro - Podcast Advertising Management Platform',
  description: 'Next-generation platform for managing podcast advertising campaigns',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
}

// Only force dynamic for routes that need it - let pages decide individually
// export const dynamic = 'force-dynamic'
// export const revalidate = 0

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Handle chunk loading errors
              window.addEventListener('error', function(e) {
                if (e.message && e.message.includes('Loading chunk')) {
                  console.log('Chunk loading error detected, reloading page...');
                  window.location.reload();
                }
              });
              
              // Handle unhandled promise rejections for chunk errors
              window.addEventListener('unhandledrejection', function(e) {
                if (e.reason && e.reason.message && e.reason.message.includes('Loading chunk')) {
                  console.log('Chunk loading error detected in promise, reloading page...');
                  window.location.reload();
                }
              });
            `,
          }}
        />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}