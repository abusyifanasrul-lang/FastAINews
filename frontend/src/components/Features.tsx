import Reveal from './Reveal';
import { DatabaseZap, Sunrise, Share2, Timer } from 'lucide-react';

const FEATURES = [
  {
    icon: DatabaseZap,
    tag: 'Aggregate',
    title: 'Automated AI Aggregation',
    desc: 'Our crawler watches 50+ top global sources — TechCrunch, MIT Review, arXiv, The Verge, X thought-leaders — 24/7. Duplicates killed, signal ranked, noise dropped.',
    metric: '50+ sources',
    sub: 'scanned every night',
    gradient: 'from-cyan-400 to-sky-500',
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(0,229,255,0.5)]',
    ring: 'group-hover:border-cyan-400/40',
  },
  {
    icon: Sunrise,
    tag: 'Brief',
    title: 'Morning Briefing',
    desc: 'Wake up to a razor-sharp 3-minute digest in your inbox at 6:00 AM. Every story summarized, ranked by impact, with why-it-matters context.',
    metric: '6:00 AM',
    sub: 'in your inbox daily',
    gradient: 'from-amber-300 to-orange-500',
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(251,191,36,0.4)]',
    ring: 'group-hover:border-amber-300/40',
  },
  {
    icon: Share2,
    tag: 'Distribute',
    title: 'Omnichannel Posting',
    desc: 'One brief becomes native posts for X, LinkedIn, Instagram, Facebook, YouTube & Telegram — auto-formatted, hashtagged, scheduled and published simultaneously.',
    metric: '6 channels',
    sub: 'one click, everywhere',
    gradient: 'from-violet-400 to-fuchsia-500',
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(139,92,246,0.5)]',
    ring: 'group-hover:border-violet-400/40',
  },
  {
    icon: Timer,
    tag: 'Save time',
    title: 'Time-Saving Efficiency',
    desc: 'Reclaim 3+ hours a day. No more doom-scrolling feeds or wrestling schedulers. The agent researches, writes, designs and posts — you just grow.',
    metric: '3+ hrs',
    sub: 'saved every single day',
    gradient: 'from-emerald-300 to-teal-500',
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(52,211,153,0.45)]',
    ring: 'group-hover:border-emerald-300/40',
  },
];

export default function Features() {
  return (
    <section id="features" className="relative scroll-mt-20 py-20 sm:py-24">
      <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Features &amp; Benefits</p>
          <h2 className="font-display mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
            Your unfair advantage in <span className="text-gradient">the AI news race</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            One autonomous agent replaces your researcher, copywriter, designer and social-media manager — running overnight, every night.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.08}>
              <div className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a0f1e]/80 p-6 transition-all duration-300 hover:-translate-y-1.5 ${f.glow} ${f.ring}`}>
                <div className={`absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${f.gradient} opacity-[0.08] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.2]`} />
                <div className="flex items-center justify-between">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${f.gradient} shadow-lg`}>
                    <f.icon className="h-6 w-6 text-[#04060d]" strokeWidth={2.2} />
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-display text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{f.tag}</span>
                </div>
                <h3 className="font-display mt-5 text-lg font-bold text-white">{f.title}</h3>
                <p className="mt-2.5 flex-1 text-sm leading-relaxed text-slate-400">{f.desc}</p>
                <div className="mt-5 border-t border-white/10 pt-4">
                  <p className={`font-display bg-gradient-to-r ${f.gradient} bg-clip-text text-2xl font-bold text-transparent`}>{f.metric}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{f.sub}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* stats band */}
        <Reveal delay={0.1}>
          <div className="neon-border mt-10 grid grid-cols-2 overflow-hidden rounded-3xl bg-[#0a0f1e]/70 lg:grid-cols-4">
            {[
              ['12,000+', 'creators & teams'],
              ['2.4M+', 'stories summarized'],
              ['98%', 'on-time 6 AM delivery'],
              ['312%', 'avg. reach growth'],
            ].map(([v, l], i) => (
              <div key={l} className={`px-6 py-6 text-center ${i !== 0 ? 'border-l border-white/10' : ''} ${i >= 2 ? 'max-lg:border-t max-lg:border-white/10' : ''} ${i === 2 ? 'max-lg:border-l-0' : ''}`}>
                <p className="font-display text-2xl font-bold text-white sm:text-3xl">{v}</p>
                <p className="mt-1 text-xs text-slate-500 sm:text-sm">{l}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
