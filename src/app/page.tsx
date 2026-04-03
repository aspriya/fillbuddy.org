import Link from 'next/link';
import {
  Shield,
  Zap,
  MousePointerClick,
  ChevronRight,
  Sparkles,
  Layers,
} from 'lucide-react';

const features = [
  {
    icon: <Shield size={24} />,
    title: 'Private & Secure',
    desc: 'Everything runs in your browser. Documents never touch any server.',
  },
  {
    icon: <Zap size={24} />,
    title: 'Smart Detection',
    desc: 'Reads fields from any PDF — even encrypted ones — using a dual-engine approach.',
  },
  {
    icon: <MousePointerClick size={24} />,
    title: 'Instant Download',
    desc: 'Fill your form with a beautiful UI and download the completed PDF in one click.',
  },
];

export default function LandingPage() {
  return (
    <div className="landing-bg min-h-screen text-gray-200">
      {/* ─── Nav ─── */}
      <nav className="animate-fade-in flex items-center justify-between px-6 sm:px-10 py-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-heading text-[22px] font-extrabold tracking-tight text-gray-100">
          <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-amber-600 to-amber-400 flex items-center justify-center">
            <Layers size={20} className="text-black" strokeWidth={2.5} />
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
      <section className="max-w-6xl mx-auto px-6 sm:px-10 pt-16 sm:pt-20 pb-14 text-center">
        <div className="animate-fade-up inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-5 py-1.5 mb-8 text-[13px] font-semibold text-amber-400">
          <Sparkles size={14} /> 100% Client-Side · Your Data Never Leaves
        </div>

        <h1 className="animate-fade-up anim-delay-1 font-heading text-[clamp(36px,6vw,72px)] font-extrabold leading-[1.05] mb-6 tracking-[-2px] max-w-3xl mx-auto">
          Fill any PDF form.{' '}
          <span className="bg-gradient-to-r from-amber-600 to-amber-300 bg-clip-text text-transparent">
            Beautifully.
          </span>
        </h1>

        <p className="animate-fade-up anim-delay-2 text-lg leading-relaxed text-gray-400 max-w-xl mx-auto mb-12">
          Upload any fillable PDF, get a clean form interface, fill it out, and
          download — all in your browser. Works with encrypted PDFs too.
        </p>

        <div className="animate-fade-up anim-delay-3">
          <Link
            href="/app"
            className="inline-flex items-center gap-1 bg-gradient-to-br from-amber-600 to-amber-700 text-white px-10 py-4 rounded-2xl text-base font-bold shadow-[0_4px_30px_rgba(217,119,6,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_40px_rgba(217,119,6,0.4)] transition-all"
          >
            Get Started <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-10 pb-24 grid grid-cols-1 md:grid-cols-3 gap-5">
        {features.map((f, i) => (
          <div
            key={i}
            className={`animate-fade-up anim-delay-${i + 3} glass-card rounded-2xl p-8 hover:bg-white/6 hover:-translate-y-1 transition-all duration-300`}
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 mb-5">
              {f.icon}
            </div>
            <h3 className="font-heading text-lg font-bold text-gray-100 mb-2.5">
              {f.title}
            </h3>
            <p className="text-sm leading-relaxed text-gray-500">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
