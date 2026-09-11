import { Link } from 'react-router-dom';
import { Zap, Twitter, Linkedin, Facebook, Instagram, Youtube, Send, ShieldCheck, FileText } from 'lucide-react';

const PRODUCT = [
  { label: 'Features', href: '/#features' },
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'Live Briefing', href: '/#briefing' },
  { label: 'Channels', href: '/#channels' },
  { label: 'Pricing', href: '/#pricing' },
];

const COMPANY = [
  { label: 'About', href: '/#get-started' },
  { label: 'Contact', href: 'mailto:hello@fastainews.ai' },
  { label: 'Careers', href: '/#get-started' },
  { label: 'Press kit', href: '/#get-started' },
];

const SOCIALS = [
  { icon: Twitter, label: 'X (Twitter)', href: 'https://x.com' },
  { icon: Linkedin, label: 'LinkedIn', href: 'https://linkedin.com' },
  { icon: Facebook, label: 'Facebook', href: 'https://facebook.com' },
  { icon: Instagram, label: 'Instagram', href: 'https://instagram.com' },
  { icon: Youtube, label: 'YouTube', href: 'https://youtube.com' },
  { icon: Send, label: 'Telegram', href: 'https://telegram.org' },
];

function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export default function Footer() {
  const goAnchor = (href: string) => {
    if (href.startsWith('/#')) {
      document.getElementById(href.slice(2))?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="border-t border-white/10 bg-[#04060d]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          {/* brand */}
          <div>
            <Link to="/" onClick={scrollTop} className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-[0_0_24px_rgba(0,229,255,0.35)] ring-1 ring-white/30">
                <img src="/logo.png" alt="Fast AI News" className="h-full w-full object-contain p-0.5" />
              </span>
              <span className="font-display text-lg font-bold tracking-tight text-white">Fast <span className="text-gradient">AI</span> News</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              The autonomous AI agent that aggregates, summarizes and publishes breaking AI news — every morning, everywhere.
            </p>
            <div className="mt-5 flex items-center gap-2.5">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400 transition-all hover:-translate-y-0.5 hover:border-cyan-400/50 hover:text-cyan-300 hover:shadow-[0_0_16px_rgba(0,229,255,0.35)]"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* product */}
          <nav aria-label="Product">
            <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Product</p>
            <ul className="mt-4 space-y-2.5">
              {PRODUCT.map((l) => (
                <li key={l.label}>
                  <button onClick={() => goAnchor(l.href)} className="text-sm text-slate-500 transition hover:text-cyan-300">{l.label}</button>
                </li>
              ))}
            </ul>
          </nav>

          {/* company */}
          <nav aria-label="Company">
            <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Company</p>
            <ul className="mt-4 space-y-2.5">
              {COMPANY.map((l) => (
                <li key={l.label}>
                  {l.href.startsWith('mailto') ? (
                    <a href={l.href} className="text-sm text-slate-500 transition hover:text-cyan-300">{l.label}</a>
                  ) : (
                    <button onClick={() => goAnchor(l.href)} className="text-sm text-slate-500 transition hover:text-cyan-300">{l.label}</button>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* legal — distinct, accessible */}
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Legal &amp; Trust</p>
            <div className="mt-4 space-y-2.5">
              <Link
                to="/privacy"
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-cyan-400/40 hover:text-white"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-300" /> Public Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-violet-400/40 hover:text-white"
              >
                <FileText className="h-4 w-4 shrink-0 text-violet-300" /> Public Terms of Service
              </Link>
              <p className="px-1 pt-1 text-xs leading-relaxed text-slate-600">SOC 2 Type II • GDPR &amp; CCPA compliant. Your data is never sold.</p>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.07] pt-7 sm:flex-row">
          <p className="text-xs text-slate-600">© 2026 Fast AI News, Inc. All rights reserved.</p>
          <div className="flex items-center gap-5 text-xs">
            <Link to="/privacy" className="text-slate-500 underline-offset-4 transition hover:text-cyan-300 hover:underline">Privacy Policy</Link>
            <Link to="/terms" className="text-slate-500 underline-offset-4 transition hover:text-cyan-300 hover:underline">Terms of Service</Link>
            <a href="mailto:hello@fastainews.ai" className="text-slate-500 transition hover:text-cyan-300">Contact</a>
          </div>
          <p className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> All systems operational
          </p>
        </div>
      </div>
    </footer>
  );
}
