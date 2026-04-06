import type { Metadata } from 'next';
import { Inter, Manrope } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });

export const metadata: Metadata = {
  title: 'FillBuddy — Fill PDFs Privately in Your Browser. Free Forever.',
  description:
    'Fill, annotate & sign any PDF directly in your browser. No uploads, no accounts, no watermarks. Save progress and resume later. 100% free, 100% private.',
  keywords: [
    'fill pdf online free',
    'pdf form filler no upload',
    'private pdf editor',
    'fill pdf without signup',
    'annotate pdf free',
    'save pdf progress',
    'pdf signature tool free',
    'fill government form pdf',
    'browser pdf editor',
    'client side pdf filler',
  ],
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'FillBuddy — Fill PDFs Privately. No Uploads. Free Forever.',
    description:
      'The only PDF filler that never touches your files. Fill, sign, and annotate any PDF in your browser. Save progress and come back later.',
    type: 'website',
    siteName: 'FillBuddy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FillBuddy — Private PDF Filler',
    description:
      'Fill any PDF in your browser. No uploads. No signups. No watermarks. Free forever.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://fillbuddy.org',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
