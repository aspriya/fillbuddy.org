import Link from 'next/link';
import Logo from '@/components/Logo';
import {
  Shield,
  Type,
  MousePointerClick,
  ChevronRight,
  Sparkles,
  Lock,
  FileText,
  PenLine,
  Check,
  X,
  Save,
  RotateCcw,
  Minus,
  Eye,
  WifiOff,
  BadgeCheck,
} from 'lucide-react';

/* ── Structured Data ─────────────────────────────────────── */

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'FillBuddy',
  url: 'https://fillbuddy.org',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any (browser-based)',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  description:
    'Fill, annotate & sign any PDF directly in your browser. No uploads, no accounts, no watermarks. Save progress and resume later.',
  featureList: [
    'Client-side PDF processing',
    'Text annotation',
    'Check and cross marks',
    'Signature with background removal',
    'Save and resume progress',
    'Strikeout tool',
    'No server uploads',
    'No account required',
  ],
};

const faqItems = [
  {
    q: 'Is FillBuddy really free?',
    a: 'Yes — completely free with no hidden limits, no watermarks, and no account required. There is no premium tier.',
  },
  {
    q: 'Does FillBuddy upload my PDF to a server?',
    a: 'Never. Your PDF is processed entirely in your browser using JavaScript. No data is sent anywhere. You can verify this by disconnecting from the internet after loading the page — it still works.',
  },
  {
    q: 'Can I save my work and continue later?',
    a: 'Yes. Click "Save" to download a .fillbuddy file that preserves your PDF and all annotations. Upload it again anytime to continue editing — all previous work remains fully editable.',
  },
  {
    q: 'Does it work with non-fillable or scanned PDFs?',
    a: 'Yes. FillBuddy renders your PDF visually and lets you place text, marks, and signatures directly on top. It doesn\'t depend on embedded form fields, so it works on any PDF.',
  },
  {
    q: 'What tools are available?',
    a: 'Text placement (with adjustable font size), check marks (✓), cross marks (✗), strikeout lines, and signatures (draw or upload with automatic background removal). All elements are movable and resizable.',
  },
  {
    q: 'How is FillBuddy different from Smallpdf, iLovePDF, or Adobe?',
    a: 'Those tools upload your documents to their servers for processing. FillBuddy is 100% client-side — your files never leave your device. Plus, our save/resume feature lets you re-edit filled PDFs, while others permanently bake annotations in.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqItems.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};

/* ── Page ─────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="landing-bg min-h-screen text-gray-200">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ─── Nav ─── */}
      <nav className="animate-fade-in flex items-center justify-between px-6 sm:px-10 py-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-heading text-[22px] font-extrabold tracking-tight text-gray-100">
          <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-amber-600 to-amber-400 flex items-center justify-center">
            <Logo size={20} className="text-white" />
          </div>
          FillBuddy
        </div>
        <Link
          href="/app"
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-gray-200 bg-white/8 border border-white/12 hover:bg-white/14 transition-all"
        >
          Open App
        </Link>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div className="hero-glow absolute inset-0 pointer-events-none" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-6 sm:px-10 pt-14 sm:pt-20 pb-16 text-center">
          <div className="animate-fade-up inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-5 py-1.5 mb-8 text-[13px] font-semibold text-amber-400">
            <Lock size={13} /> 100% Client-Side — Your files never leave your device
          </div>

          <h1 className="animate-fade-up anim-delay-1 font-heading text-[clamp(36px,6vw,72px)] font-extrabold leading-[1.05] mb-6 tracking-[-0.03em] max-w-4xl mx-auto">
            Fill PDFs. Not{' '}
            <span className="bg-gradient-to-r from-amber-500 to-amber-300 bg-clip-text text-transparent">
              upload forms.
            </span>
          </h1>

          <p className="animate-fade-up anim-delay-2 text-lg sm:text-xl leading-relaxed text-gray-400 max-w-2xl mx-auto mb-5">
            Type, sign, and annotate directly on any PDF — right in your browser.
            No accounts, no uploads, no watermarks. Save your progress and come
            back later.
          </p>

          <p className="animate-fade-up anim-delay-2 text-sm text-gray-500 mb-10">
            Works on government forms, bank forms, legal documents, and encrypted PDFs.
          </p>

          <div className="animate-fade-up anim-delay-3 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 bg-gradient-to-br from-amber-600 to-amber-700 text-white px-10 py-4 rounded-2xl text-base font-bold shadow-[0_4px_30px_rgba(217,119,6,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_40px_rgba(217,119,6,0.4)] transition-all"
            >
              Start Filling — Free <ChevronRight size={18} />
            </Link>
            <span className="text-[13px] text-gray-500">
              No signup required. Opens instantly.
            </span>
          </div>

          {/* ─── Product Preview ─── */}
          <div className="animate-fade-up anim-delay-5 max-w-3xl mx-auto mt-16 relative">
            <div className="absolute -inset-8 bg-amber-500/[0.06] rounded-3xl blur-3xl pointer-events-none" aria-hidden="true" />
            <div className="relative rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/60">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#111827] border-b border-white/[0.06]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                </div>
                <div className="flex-1 text-center text-[10px] text-gray-600 font-mono tracking-wide">fillbuddy.org/app</div>
              </div>
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 bg-[#0f172a] border-b border-white/[0.06]">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-semibold">
                  <Type size={10} /> Text
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md text-gray-500 text-[10px]">
                  <Check size={10} /> Tick
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md text-gray-500 text-[10px]">
                  <X size={10} /> Cross
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md text-gray-500 text-[10px]">
                  <Minus size={10} /> Strike
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md text-gray-500 text-[10px]">
                  <PenLine size={10} /> Sign
                </div>
                <div className="flex-1" />
                <div className="hidden sm:block px-3 py-1 rounded-md bg-amber-600 text-white text-[10px] font-semibold">Download PDF</div>
              </div>
              {/* PDF canvas */}
              <div className="p-4 sm:p-8 flex justify-center bg-[#0a0f1a]">
                <div className="w-full max-w-sm bg-white rounded-sm shadow-lg p-6 sm:p-8 text-left">
                  {/* Form heading */}
                  <div className="h-3 w-40 bg-gray-300 rounded-sm mb-1" />
                  <div className="h-px w-full bg-gray-200 mb-5" />
                  {/* Name field with annotation */}
                  <div className="mb-4">
                    <div className="h-1.5 w-16 bg-gray-200 rounded-full mb-1.5" />
                    <div className="inline-block border-2 border-blue-400/60 rounded px-2 py-0.5 bg-blue-50/50">
                      <span className="text-[11px] text-gray-800 font-medium">John Smith</span>
                    </div>
                  </div>
                  {/* Form lines */}
                  <div className="space-y-2.5 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-12 bg-gray-200 rounded-full" />
                      <div className="h-1.5 w-28 bg-gray-100 rounded-full" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-14 bg-gray-200 rounded-full" />
                      <div className="h-1.5 w-36 bg-gray-100 rounded-full" />
                    </div>
                  </div>
                  {/* Checkbox with check */}
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-4 h-4 rounded border-2 border-emerald-500/60 flex items-center justify-center bg-emerald-50/50">
                      <Check size={10} className="text-emerald-600" strokeWidth={3} />
                    </div>
                    <div className="h-1.5 w-32 bg-gray-100 rounded-full" />
                  </div>
                  {/* Signature */}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="h-1.5 w-20 bg-gray-200 rounded-full mb-2" />
                    <div className="inline-block border-2 border-dashed border-amber-400/60 rounded-md px-3 py-2">
                      <svg viewBox="0 0 120 30" className="w-24 h-6 text-gray-700" aria-hidden="true">
                        <path d="M5 20 Q 15 5, 30 18 Q 45 30, 55 15 Q 65 2, 80 20 Q 90 28, 100 12 L 115 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>
                  {/* Page number */}
                  <div className="text-right mt-4">
                    <span className="text-[9px] text-gray-400">Page 1 of 1</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Trust Bar ─── */}
      <section className="animate-fade-up anim-delay-4 max-w-4xl mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[13px] text-gray-500">
          <span className="flex items-center gap-1.5"><Shield size={14} className="text-emerald-500" /> No server uploads</span>
          <span className="flex items-center gap-1.5"><BadgeCheck size={14} className="text-emerald-500" /> No account needed</span>
          <span className="flex items-center gap-1.5"><Eye size={14} className="text-emerald-500" /> No watermarks</span>
          <span className="flex items-center gap-1.5"><WifiOff size={14} className="text-emerald-500" /> Works offline</span>
          <span className="flex items-center gap-1.5"><Sparkles size={14} className="text-emerald-500" /> Free forever</span>
        </div>
      </section>

      <div className="gradient-sep max-w-5xl mx-auto" />

      {/* ─── How It Works ─── */}
      <section className="max-w-5xl mx-auto px-6 sm:px-10 py-16">
        <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-center text-gray-100 mb-4 tracking-tight">
          Three steps. That&apos;s it.
        </h2>
        <p className="text-center text-gray-500 mb-12 max-w-lg mx-auto">
          No account creation. No file upload to servers. Just your PDF and your browser.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: '1', title: 'Drop your PDF', desc: 'Drag and drop any PDF — fillable, scanned, or encrypted. It opens instantly in your browser.', icon: <FileText size={24} /> },
            { step: '2', title: 'Fill & annotate', desc: 'Click anywhere to type. Add check marks, cross marks, strikeouts, or your signature. Move and resize everything.', icon: <PenLine size={24} /> },
            { step: '3', title: 'Download or save', desc: 'Download the finished PDF or save a .fillbuddy file to continue editing later. All annotations stay editable.', icon: <Save size={24} /> },
          ].map((s) => (
            <div key={s.step} className="glass-card rounded-2xl p-8 text-center hover:bg-white/6 transition-all">
              <div className="w-12 h-12 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto mb-5 text-lg font-bold font-heading">
                {s.step}
              </div>
              <h3 className="font-heading text-lg font-bold text-gray-100 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
        <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-center text-gray-100 mb-4 tracking-tight">
          Everything you need. Nothing you don&apos;t.
        </h2>
        <p className="text-center text-gray-500 mb-12 max-w-lg mx-auto">
          One focused tool that does PDF filling brilliantly, instead of 30 tools that do it okay.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: <Lock size={22} />, title: 'Truly private', desc: 'Your PDF is processed with JavaScript in your browser. Zero bytes sent to any server. Disconnect your internet — it still works.' },
            { icon: <MousePointerClick size={22} />, title: 'Click-to-place text', desc: 'Click anywhere on the PDF to start typing. Adjust font size, move text around, edit anytime. No form field detection needed.' },
            { icon: <Check size={22} />, title: 'Check & cross marks', desc: 'Place ✓ or ✗ marks of any size. Perfect for checkboxes, approval forms, and questionnaires.' },
            { icon: <Minus size={22} />, title: 'Strikeout lines', desc: 'Draw strikethrough lines across text. Resize width and thickness. Essential for redlining documents.' },
            { icon: <PenLine size={22} />, title: 'Signatures', desc: 'Draw your signature or upload an image. White background is automatically removed for a clean, transparent result.' },
            { icon: <RotateCcw size={22} />, title: 'Save & resume', desc: 'Save a .fillbuddy file to pick up exactly where you left off. Every annotation stays fully editable — no more "tattooed" text.' },
          ].map((f, i) => (
            <div key={i} className="glass-card rounded-2xl p-7 hover:bg-white/6 hover:-translate-y-0.5 transition-all duration-300">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 mb-4">
                {f.icon}
              </div>
              <h3 className="font-heading text-base font-bold text-gray-100 mb-2">{f.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="gradient-sep max-w-5xl mx-auto" />

      {/* ─── Pain Points / Why FillBuddy ─── */}
      <section className="max-w-5xl mx-auto px-6 sm:px-10 py-16">
        <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-center text-gray-100 mb-4 tracking-tight">
          Sound familiar?
        </h2>
        <p className="text-center text-gray-500 mb-12 max-w-lg mx-auto">
          We built FillBuddy because every other option had the same problems.
        </p>
        <div className="space-y-3 max-w-2xl mx-auto">
          {[
            { pain: '"I saved my filled PDF and now I can\'t edit what I typed"', fix: 'FillBuddy\'s save files keep all annotations editable. Come back anytime.' },
            { pain: '"This tool uploaded my tax form to a server I don\'t trust"', fix: 'FillBuddy is 100% client-side. Your documents never leave your device.' },
            { pain: '"It doesn\'t recognize the form fields in my PDF"', fix: 'FillBuddy doesn\'t need form fields. You type directly on the rendered page.' },
            { pain: '"I just need to fill one form, not pay $13/month"', fix: 'FillBuddy is free. No hidden limits. No premium tier. No account.' },
            { pain: '"The free version puts a watermark on my downloaded PDF"', fix: 'FillBuddy: no watermarks, no branding. Your PDF, clean.' },
          ].map((item, i) => (
            <div
              key={i}
              className="group relative rounded-xl bg-white/[0.025] hover:bg-white/[0.045] border border-white/[0.06] transition-all duration-300 overflow-hidden"
            >
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-amber-500 to-amber-600/40" />
              <div className="pl-7 pr-6 py-5 sm:pl-8 sm:pr-7 sm:py-6 flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Pain */}
                <p className="text-[15px] text-gray-400 italic leading-relaxed sm:flex-1 line-through decoration-white/[0.08] decoration-1">{item.pain}</p>
                {/* Arrow */}
                <ChevronRight size={16} className="hidden sm:block text-amber-500/50 shrink-0 mt-1" />
                {/* Fix */}
                <p className="text-sm text-gray-200 leading-relaxed sm:flex-1 flex items-start gap-2">
                  <span className="inline-flex w-5 h-5 rounded-full bg-emerald-500/15 items-center justify-center shrink-0 mt-0.5">
                    <Check size={11} className="text-emerald-400" strokeWidth={3} />
                  </span>
                  {item.fix}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Comparison Table ─── */}
      <section className="max-w-4xl mx-auto px-6 sm:px-10 py-16">
        <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-center text-gray-100 mb-4 tracking-tight">
          How FillBuddy compares
        </h2>
        <p className="text-center text-gray-500 mb-10">
          We focus on one job and do it better than anyone.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-gray-500 font-medium"></th>
                <th className="py-3 px-4 text-amber-400 font-bold font-heading bg-amber-500/[0.08]">FillBuddy</th>
                <th className="py-3 px-4 text-gray-500 font-medium">Adobe</th>
                <th className="py-3 px-4 text-gray-500 font-medium">Smallpdf</th>
                <th className="py-3 px-4 text-gray-500 font-medium">iLovePDF</th>
              </tr>
            </thead>
            <tbody className="text-gray-400">
              {[
                ['Price', 'Free forever', '$12.99/mo', '$9/mo', 'Freemium'],
                ['Account required', 'No', 'Yes', 'Yes', 'Yes'],
                ['Files stay on device', 'Always', 'No', 'No', 'No'],
                ['Save & re-edit progress', 'Yes', 'Limited', 'No', 'No'],
                ['Works on any PDF', 'Yes', 'Partial', 'Partial', 'Partial'],
                ['Watermarks', 'Never', 'No*', 'Free tier', 'Free tier'],
                ['Works offline', 'Yes', 'Desktop only', 'No', 'No'],
              ].map((row, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="py-3 px-4 text-gray-300 font-medium">{row[0]}</td>
                  <td className="py-3 px-4 text-center text-amber-400 font-semibold bg-amber-500/[0.04]">{row[1]}</td>
                  <td className="py-3 px-4 text-center">{row[2]}</td>
                  <td className="py-3 px-4 text-center">{row[3]}</td>
                  <td className="py-3 px-4 text-center">{row[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="gradient-sep max-w-5xl mx-auto" />

      {/* ─── FAQ ─── */}
      <section className="max-w-3xl mx-auto px-6 sm:px-10 py-16">
        <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-center text-gray-100 mb-10 tracking-tight">
          Frequently asked questions
        </h2>
        <div className="space-y-5">
          {faqItems.map((item, i) => (
            <details key={i} className="glass-card rounded-xl group">
              <summary className="flex items-center justify-between cursor-pointer p-5 text-gray-200 font-medium text-sm list-none">
                {item.q}
                <ChevronRight size={16} className="text-gray-500 group-open:rotate-90 transition-transform shrink-0 ml-4" />
              </summary>
              <div className="px-5 pb-5 text-sm text-gray-400 leading-relaxed">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-16 pb-8 text-center">
        <h2 className="font-heading text-2xl sm:text-4xl font-extrabold text-gray-100 mb-4 tracking-tight">
          Ready to fill a PDF the right way?
        </h2>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          No signup. No credit card. No tricks. Just drop your PDF and go.
        </p>
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 bg-gradient-to-br from-amber-600 to-amber-700 text-white px-10 py-4 rounded-2xl text-base font-bold shadow-[0_4px_30px_rgba(217,119,6,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_40px_rgba(217,119,6,0.4)] transition-all"
        >
          Open FillBuddy <ChevronRight size={18} />
        </Link>
      </section>

      {/* ─── Footer ─── */}
      <footer className="max-w-6xl mx-auto px-6 sm:px-10 py-10 border-t border-white/5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2 font-heading font-bold text-gray-500">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-600 to-amber-400 flex items-center justify-center">
              <Logo size={12} className="text-white" />
            </div>
            FillBuddy
          </div>
          <p>
            100% free &amp; open. Built for people who just need to fill a damn PDF.
          </p>
          <p>© {new Date().getFullYear()} FillBuddy</p>
        </div>
      </footer>
    </div>
  );
}
