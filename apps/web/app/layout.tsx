import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Chakra_Petch, IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

import { Nav } from '@/components/Nav';

const display = Chakra_Petch({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display' });
const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: { default: 'CodeBattle', template: '%s · CodeBattle' },
  description: 'Real-time 1v1 coding battles. Same problem, same clock, rated by Elo.',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = { themeColor: '#0A0B10' };

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-you focus:px-3 focus:py-1.5 focus:text-ink">
          Skip to content
        </a>
        <Nav />
        <main id="main" className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-6 sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
