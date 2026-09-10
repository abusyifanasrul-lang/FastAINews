import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, Bot, Check, Sparkles, Play, ShieldCheck,
  Twitter, Linkedin, Facebook, Instagram, Youtube, Send, Clock3,
} from 'lucide-react';

const SOCIALS = [
  { icon: Twitter, label: 'X', color: 'hover:border-sky-400/60' },
  { icon: Linkedin, label: 'LinkedIn', color: 'hover:border-blue-500/60' },
  { icon: Facebook, label: 'Facebook', color: 'hover:border-indigo-400/60' },
  { icon: Instagram, label: 'Instagram', color: 'hover:border-fuchsia-400/60' },
  { icon: Youtube, label: 'YouTube', color: 'hover:border-rose-400/60' },
  { icon: Send, label: 'Telegram', color: 'hover:border-cyan-400/60' },
];

const TICKER = [
  'GPT reasoning breakthrough', 'Open-source model tops charts', 'AI agents ship code 4x faster',
  'New video model goes viral', 'Regulators approve AI safety bill', 'Chip prices drop 30%',
];

function AgentVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      {/* glow */}
      <div className="absolute left-1/2 top-1/2 -z-10 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,229,255,0.18),rgba(139,92,246,0.14),transparent_70%)] blur-2xl" />

      <div className="neon-border relative overflow-hidden rounded-3xl bg-[#0a0f1e]/90 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
        {/* window bar */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300">Agent Live</span>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-[1fr_1.15fr]">
          {/* sources feed */}
          <div className="space-y-2.5">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Ingesting • 50+ sources</p>
            {['TechCrunch AI', 'MIT Review', 'arXiv Daily', 'The Verge'].map((s, i) => (
              <motion.div
                key={s}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.18, duration: 0.5 }}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${i % 2 ? 'bg-violet-500/20 text-violet-300' : 'bg-cyan-400/15 text-cyan-300'}`}>
                  {s.split(' ').map(w => w[0]).join('').slice(0,2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-200">{s}</p>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500"
                      initial={{ width: '8%' }}
                      animate={{ width: '100%' }}
                      transition={{ delay: 0.6 + i * 0.18, duration: 1.1, ease: 'easeOut' }}
                    />
                  </div>
                </div>
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              </motion.div>
            ))}
            {/* AI core */}
            <div className="relative mt-1 flex items-center gap-3 overflow-hidden rounded-xl border border-cyan-400/25 bg-gradient-to-r from-cyan-400/10 via-sky-500/10 to-violet-500/10 p-3">
              <span className="pulse-ring relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-600">
                <Bot className="h-5 w-5 text-white" />
              </span>
              <div>
                <p className="flex items-center gap-1 text-xs font-semibold text-white">Summarizing <Sparkles className="h-3 w-3 text-cyan-300" /></p>
                <p className="font-mono text-[11px] text-cyan-200/80">12 stories → 3 min brief</p>
              </div>
            </div>
          </div>

          {/* scheduled posts */}
          <div className="flex flex-col rounded-2xl border border-white/10 bg-[#05070f]/70 p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Auto-scheduled • 6:00 AM</p>
              <span className="flex items-center gap-1 rounded-full bg-cyan-400/10 px-2 py-0.5 font-mono text-[10px] text-cyan-300"><Clock3 className="h-3 w-3" /> 06:00</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[11px] leading-relaxed text-slate-300">
                <span className="font-semibold text-white">⚡ Morning AI Brief — Sep 10</span><br />
                1/ Reasoning models just leveled up… 🧵👇<br />
                <span className="text-cyan-300">#AI #MachineLearning</span>
              </p>
              <div className="mt-2.5 h-16 rounded-lg bg-gradient-to-br from-cyan-500/25 via-violet-500/25 to-fuchsia-500/20 ring-1 ring-inset ring-white/10" />
              <div className="mt-2.5 flex items-center gap-1.5">
                {SOCIALS.slice(0, 5).map((s, i) => (
                  <motion.span
                    key={s.label}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1 + i * 0.12, type: 'spring', stiffness: 300, damping: 16 }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white/8 ring-1 ring-white/15"
                    title={s.label}
                  >
                    <s.icon className="h-3 w-3 text-slate-200" />
                  </motion.span>
                ))}
                <span className="ml-auto rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Queued ✓</span>
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {[['X', '9.2K'], ['LinkedIn', '4.1K'], ['IG', '6.8K']].map(([k, v], i) => (
                <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 + i * 0.15 }} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center">
                  <p className="text-[10px] text-slate-400">{k}</p>
                  <p className="font-display text-xs font-bold text-white">{v}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* bottom status */}
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 font-mono text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" /> publishing to 6 channels…</span>
          <span className="text-emerald-300">100% automated</span>
        </div>
      </div>

      {/* floating badges */}
      <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} className="absolute -left-3 top-10 hidden rounded-2xl border border-white/10 bg-[#0d1426]/95 px-3.5 py-2.5 shadow-xl backdrop-blur sm:block">
        <p className="font-display text-lg font-bold text-white leading-none">2,418</p>
        <p className="mt-1 text-[11px] text-slate-400">stories today</p>
      </motion.div>
      <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }} className="absolute -right-3 bottom-16 hidden rounded-2xl border border-white/10 bg-[#0d1426]/95 px-3.5 py-2.5 shadow-xl backdrop-blur sm:block">
        <p className="flex items-center gap-1 font-display text-lg font-bold text-white leading-none">+312% <span className="text-[10px] font-medium text-emerald-300">reach</span></p>
        <p className="mt-1 text-[11px] text-slate-400">avg. growth</p>
      </motion.div>
    </div>
  );
}

export default function Hero() {
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

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="relative overflow-hidden pt-[68px]">
      {/* backdrop */}
      <div className="bg-grid absolute inset-0" />
      <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(0,229,255,0.14),rgba(139,92,246,0.12),transparent_65%)] blur-3xl" />
      <div className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-violet-600/15 blur-[120px]" />
      <div className="absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-cyan-400/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:grid lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-12 lg:px-8 lg:pb-20 lg:pt-20">
        <div className="max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/[0.07] px-4 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
            </span>
            <span className="text-xs font-semibold tracking-wide text-cyan-200">AUTONOMOUS AI AGENT • POSTS WHILE YOU SLEEP</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="font-display mt-6 text-4xl font-bold leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-[3.6rem]"
          >
            The Fastest AI News, <br className="hidden sm:block" />
            <span className="text-gradient">Delivered &amp; Posted</span> Automatically
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16 }}
            className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg"
          >
            Our autonomous agent <span className="text-slate-200 font-medium">aggregates breaking AI news</span> from 50+ top global sources, summarizes it into a sharp morning briefing, then <span className="text-slate-200 font-medium">schedules &amp; publishes everywhere</span> — X, LinkedIn, Instagram &amp; more — all before 6 AM.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.24 }} className="mt-8">
            {!done ? (
              <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email to get the 6 AM brief"
                    className="h-[52px] w-full rounded-2xl border border-white/12 bg-white/[0.05] pl-5 pr-4 text-sm text-white placeholder:text-slate-500 outline-none backdrop-blur transition focus:border-cyan-400/60 focus:bg-white/[0.07] focus:shadow-[0_0_0_4px_rgba(0,229,255,0.12)]"
                  />
                </div>
                <button
                  type="submit"
                  className="group flex h-[52px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-500 px-7 text-sm font-bold text-[#04060d] transition-all hover:shadow-[0_0_36px_rgba(0,229,255,0.5)] hover:brightness-110 active:scale-[0.98]"
                >
                  Start Free Trial
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </form>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/20"><Check className="h-5 w-5 text-emerald-300" /></span>
                <div>
                  <p className="text-sm font-semibold text-white">You&apos;re on the list! ⚡</p>
                  <p className="text-xs text-slate-400">First automated brief lands tomorrow at 6:00 AM. Check {email}.</p>
                </div>
              </motion.div>
            )}
            {error && <p className="mt-2 text-xs font-medium text-rose-300">{error}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> No credit card required</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> 5-minute setup</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-cyan-300" /> Cancel anytime</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.7 }} className="mt-8 flex items-center gap-4">
            <div className="flex -space-x-2.5">
              {['AK', 'JM', 'RS', 'LT'].map((n, i) => (
                <span key={n} className={`flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-[#05070F] ${['bg-gradient-to-br from-cyan-500 to-blue-600', 'bg-gradient-to-br from-violet-500 to-fuchsia-600', 'bg-gradient-to-br from-emerald-500 to-teal-600', 'bg-gradient-to-br from-amber-500 to-rose-600'][i]}`}>{n}</span>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1 text-amber-300 text-sm">★★★★★ <span className="ml-1 font-semibold text-white">4.9</span></div>
              <p className="text-xs text-slate-500">Loved by <span className="font-semibold text-slate-300">12,000+ creators</span> &amp; newsrooms</p>
            </div>
            <button onClick={() => scrollTo('how-it-works')} className="ml-2 hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-400/40 hover:text-white sm:flex">
              <Play className="h-3.5 w-3.5 text-cyan-300" fill="currentColor" /> Watch how it works
            </button>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, delay: 0.3 }} className="mt-12 lg:mt-0">
          <AgentVisual />
        </motion.div>
      </div>

      {/* ticker */}
      <div className="relative border-y border-white/10 bg-white/[0.02] py-3.5 backdrop-blur">
        <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
          <div className="animate-marquee flex shrink-0 items-center gap-8 pr-8">
            {[...TICKER, ...TICKER].map((t, i) => (
              <span key={i} className="flex items-center gap-2 whitespace-nowrap font-mono text-xs text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" /> {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
