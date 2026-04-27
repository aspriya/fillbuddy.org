import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import Logo from '@/components/Logo';

export const metadata: Metadata = {
  title: 'Privacy — FillBuddy',
  description:
    'Exactly what FillBuddy does and does not collect. Your PDF never leaves your browser. Anonymous usage events only.',
  alternates: { canonical: 'https://fillbuddy.org/privacy' },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Nav */}
      <nav className="flex items-center gap-4 px-6 sm:px-10 py-5 border-b border-slate-200 bg-white">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft size={18} /> Back
        </Link>
        <div className="flex items-center gap-2 font-heading text-lg font-extrabold text-slate-900 tracking-tight">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-600 to-amber-400 flex items-center justify-center">
            <Logo size={14} className="text-white" />
          </div>
          FillBuddy
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 sm:px-10 py-12 sm:py-16">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <ShieldCheck size={20} className="text-emerald-600" />
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Privacy
          </h1>
        </div>
        <p className="text-sm text-slate-500 mb-1">
          Last updated: April 2026
        </p>
        <p className="text-sm text-slate-500 mb-10">
          FillBuddy is a product by{' '}
          <a
            href="https://devtuskers.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-slate-700 hover:text-amber-600 transition-colors"
          >
            DevTuskers
          </a>
          .
        </p>

        <section className="space-y-6 text-[15px] leading-7 text-slate-700">
          <p className="text-lg text-slate-900">
            <strong>Your PDF never leaves your browser.</strong> All parsing,
            annotating, and exporting happens locally on your device. There
            is no upload, no server-side processing, no account, and no third-party tracker.
          </p>

          <h2 className="font-heading text-xl font-bold text-slate-900 pt-4">
            What we measure
          </h2>
          <p>
            So we know whether the tool actually works for people, we log a
            small anonymous event to our own server when you use FillBuddy.
            Each event includes:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-700">
            <li>
              The kind of action (e.g. <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[13px]">pdf_upload</code>,{' '}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[13px]">pdf_download</code>,{' '}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[13px]">fillbuddy_save</code>)
            </li>
            <li>A random ID generated in your browser — no name, no email, no account</li>
            <li>Your country (from Cloudflare&apos;s edge — never your IP address)</li>
            <li>Your browser family (Chrome / Firefox / Safari / Edge / other)</li>
            <li>Whether you&apos;re on desktop, mobile, or tablet</li>
            <li>The PDF&apos;s page count and a coarse file-size bucket (e.g. &ldquo;1&ndash;5MB&rdquo;)</li>
            <li>The time of the action</li>
          </ul>

          <h2 className="font-heading text-xl font-bold text-slate-900 pt-4">
            What we never collect
          </h2>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-700">
            <li>The PDF file or any of its contents</li>
            <li>The filename</li>
            <li>What you typed, drew, or annotated</li>
            <li>Your IP address</li>
            <li>Your exact location (we only get country)</li>
            <li>Your name, email, or any account information — there are no accounts</li>
            <li>Your exact browser version or User-Agent string</li>
            <li>Cookies for tracking, fingerprints, or any third-party analytics</li>
          </ul>

          <h2 className="font-heading text-xl font-bold text-slate-900 pt-4">
            How to opt out
          </h2>
          <p>
            You can disable analytics entirely by opening your browser&apos;s
            developer console on <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[13px]">fillbuddy.org</code>{' '}
            and running:
          </p>
          <pre className="bg-slate-900 text-slate-100 px-4 py-3 rounded-xl text-[13px] overflow-x-auto">
            <code>localStorage.setItem(&apos;fb_analytics_opt_out&apos;, &apos;1&apos;)</code>
          </pre>
          <p>
            FillBuddy respects this immediately — no further events will be
            sent from that browser. To re-enable, run{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[13px]">localStorage.removeItem(&apos;fb_analytics_opt_out&apos;)</code>.
          </p>

          <h2 className="font-heading text-xl font-bold text-slate-900 pt-4">
            Why we collect this at all
          </h2>
          <p>
            FillBuddy is a one-person side project. The numbers above tell us
            whether the tool is genuinely useful (do people actually finish
            filling their PDFs?) and where users come from (so support and
            ad spend land in the right time zone). They do not identify
            anyone, and they cannot be combined to identify anyone.
          </p>

          <h2 className="font-heading text-xl font-bold text-slate-900 pt-4">
            Where the data lives
          </h2>
          <p>
            Events are stored in a Cloudflare D1 database (SQLite, edge-located).
            Only DevTuskers (the studio behind FillBuddy) has access. We do not
            share, sell, or otherwise transmit this data to anyone.
          </p>

          <h2 className="font-heading text-xl font-bold text-slate-900 pt-4">
            Contact
          </h2>
          <p>
            Questions, corrections, or you&apos;d like your data removed (we can
            delete by visitor ID — open dev tools, copy{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[13px]">localStorage.fb_visitor_id</code>,
            and email it to us)? Email{' '}
            <a
              href="mailto:hello@devtuskers.com?subject=FillBuddy%20privacy%20question"
              className="font-semibold text-slate-900 underline decoration-amber-400 underline-offset-2 hover:text-amber-700"
            >
              hello@devtuskers.com
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
