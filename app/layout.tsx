import type { Metadata } from 'next'
import './globals.css'
import './globals-servicenow.css'
import { I18nProvider } from '@/lib/i18n'
import { DocumentTitle } from '@/components/layout/DocumentTitle'

export const metadata: Metadata = {
  title: 'ITSM',
  description: 'IT service management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&family=Open+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <I18nProvider>
          <DocumentTitle />
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}

