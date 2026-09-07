import type { Metadata } from 'next';
import { Inter, Inter_Tight } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const interTight = Inter_Tight({ subsets: ['latin'], variable: '--font-inter-tight' });

export const metadata: Metadata = {
  title: 'Lead Command Center',
  description: 'Autonomous opportunity discovery & outreach engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html 
      lang="en" 
      className={`${inter.variable} ${interTight.variable}`}
      suppressHydrationWarning
    >
      <body 
        suppressHydrationWarning
        className="bg-[var(--color-canvas)] text-[var(--color-ink)] min-h-screen antialiased selection:bg-[var(--color-sky-wash)] selection:text-[var(--color-ink)]"
      >
        {children}
      </body>
    </html>
  );
}

