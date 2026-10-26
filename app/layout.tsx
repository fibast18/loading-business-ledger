import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Loading Business Ledger',
  description: 'Track loader balances, client payables, payments, and reloads online or offline.',
  manifest: '/manifest.webmanifest',
  themeColor: '#276244',
  icons: { icon: '/favicon-32.png', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Load Ledger', statusBarStyle: 'default' },
  openGraph: { title: 'Loading Business Ledger', description: 'Wallet balances, client payables, payments, and reloads in one offline-ready app.' },
  twitter: { card: 'summary', title: 'Loading Business Ledger', description: 'Manage your loading business online or offline.' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
