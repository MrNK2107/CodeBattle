import './globals.css';
import type { ReactNode } from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CodeBattle',
  description: 'Real-time competitive coding battles'
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-slate-100">
        <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
      </body>
    </html>
  );
}
