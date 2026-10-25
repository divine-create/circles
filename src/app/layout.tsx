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
      <body className="min-h-screen flex flex-col bg-sand-50 text-stone-900 antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-sand-200 bg-white py-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-forest-700" />
              <span className="font-semibold text-stone-800">Circles Platform</span>
              <span>— Configurable digital environments for real communities.</span>
            </div>
            <div className="flex items-center gap-6 text-xs text-stone-500">
              <span>PostgreSQL + Row-Level Security</span>
              <span>Modular Capability Engine</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
