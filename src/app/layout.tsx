import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/navbar';

export const metadata: Metadata = {
  title: 'Circles — Modular Community Platform',
  description:
    'One shared platform. Many types of communities. Each community configures its own experience.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[#FAFAFA] text-zinc-950 antialiased font-sans">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-black/[0.06] bg-white/80 backdrop-blur-md py-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
            <div className="flex items-center gap-2.5 text-xs text-stone-600">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-900" />
              </span>
              <span className="font-bold text-stone-900 tracking-tight">Circles Platform</span>
              <span className="text-stone-300">·</span>
              <span className="text-stone-500">Configurable environments for real communities</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-mono text-stone-400">
              <span className="rounded-md bg-stone-100 px-2 py-0.5 border border-stone-200/60">PostgreSQL RLS</span>
              <span className="rounded-md bg-stone-100 px-2 py-0.5 border border-stone-200/60">Modular Monolith</span>
              <span className="rounded-md bg-stone-100 px-2 py-0.5 border border-stone-200/60">Strict TypeScript</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
