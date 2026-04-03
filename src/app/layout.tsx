import type { Metadata } from 'next';
import { Syne, Manrope } from 'next/font/google';
import './globals.css';

const syne = Syne({ subsets: ['latin'], variable: '--font-syne' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });

export const metadata: Metadata = {
  title: 'FillBuddy — Fill Any PDF Form Online',
  description:
    'Upload any fillable PDF, get a clean form interface, fill it out, and download. 100% client-side. Your data never leaves your browser.',
  openGraph: {
    title: 'FillBuddy — Fill Any PDF Form Online',
    description:
      'Upload any fillable PDF and fill it beautifully in your browser.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${manrope.variable}`}>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
