import { useState } from 'react';
import { ArrowRight, Check, ShieldCheck, Zap } from 'lucide-react';
import Reveal from './Reveal';

export default function FinalCTA() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setDone(true);
  };

  return (
    <section id="get-started" className="relative scroll-mt-20 px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
      <Reveal>
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0f1e]">
          {/* backdrop fx */}
          <div className="bg-grid absolute inset-0 opacity-70" />
          <div className="absolute -top-32 left-1/2 h-72 w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(0,229,255,0.22),rgba(139,92,246,0.18),transparent_70%)] blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />

          <div className="relative px-6 py-14 text-center sm:px-12 sm:py-16 lg:py-20">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-300">
              <Zap className="h-3.5 w-3.5 text-cyan-300" fill="currentColor" /> Join 12,000+ creators on autopilot
            </span>
            <h2 className="font-display mx-auto mt-6 max-w-3xl text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl">
              Never miss AI news again. <span className="text-gradient">Never post manually again.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-slate-400">
              Set up in 5 minutes tonight — wake up tomorrow to your first 6 AM brief, already published everywhere.
            </p>

            {!done ? (
              <form onSubmit={submit} className="mx-auto mt-8 flex max-w-lg flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-[54px] flex-1 rounded-2xl border border-white/15 bg-[#05070f]/80 px-5 text-sm text-white placeholder:text-slate-500 outline-none backdrop-blur transition focus:border-cyan-400/60 focus:shadow-[0_0_0_4px_rgba(0,229,255,0.12)]"
                />
                <button
                  type="submit"
                  className="group flex h-[54px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-500 px-7 text-sm font-bold text-[#04060d] transition-all hover:shadow-[0_0_40px_rgba(0,229,255,0.55)] hover:brightness-110 active:scale-[0.98]"
                >
                  Subscribe Now <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </form>
            ) : (
              <div className="mx-auto mt-8 flex max-w-lg items-center justify-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-6 py-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/20"><Check className="h-5 w-5 text-emerald-300" /></span>
                <p className="text-left text-sm text-slate-200"><span className="font-semibold text-white">Welcome aboard! ⚡</span><br />Your first automated brief arrives tomorrow at 6:00 AM.</p>
              </div>
            )}
            {error && <p className="mt-2 text-xs font-medium text-rose-300">{error}</p>}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> Free 14-day Pro trial</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> No credit card required</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-cyan-300" /> Cancel anytime</span>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
