import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Zap, Menu, X, ArrowRight } from 'lucide-react';

const LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'Live Briefing', href: '/#briefing' },
  { label: 'Pricing', href: '/#pricing' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    if (href.startsWith('/#')) {
      const id = href.slice(2);
      if (location.pathname !== '/') {
        navigate('/');
        setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 120);
      } else {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass border-b border-white/10 shadow-[0_8px_40px_-12px_rgba(0,229,255,0.25)]' : 'bg-transparent border-b border-transparent'
      }`}
    >
      <nav className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-[0_0_24px_rgba(0,229,255,0.4)] ring-1 ring-white/30 transition-transform group-hover:scale-105">
            <img src="/logo.png" alt="Fast AI News" className="h-full w-full object-contain p-0.5" />
          </span>
          <span className="font-display text-lg font-700 font-bold tracking-tight text-white">
            Fast <span className="text-gradient">AI</span> News
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <button
              key={l.label}
              onClick={() => go(l.href)}
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            onClick={() => go('/#pricing')}
            className="text-sm font-medium text-slate-300 transition hover:text-white"
          >
            Sign in
          </button>
          <button
            onClick={() => go('/#get-started')}
            className="group flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-2.5 text-sm font-semibold text-[#04060d] transition-all hover:shadow-[0_0_28px_rgba(0,229,255,0.55)] hover:brightness-110"
          >
            Get Started
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-300 lg:hidden ${
          open ? 'max-h-[420px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="glass mx-4 mb-4 space-y-1 rounded-2xl border border-white/10 p-4">
          {LINKS.map((l) => (
            <button
              key={l.label}
              onClick={() => go(l.href)}
              className="block w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-200 transition hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </button>
          ))}
          <button
            onClick={() => go('/#get-started')}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-3 text-sm font-semibold text-[#04060d]"
          >
            Get Started <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
