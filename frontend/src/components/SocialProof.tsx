import { useState } from 'react';
import { Star, BadgeCheck, Plus } from 'lucide-react';
import Reveal from './Reveal';

const QUOTES = [
  {
    quote: 'I went from 2K to 48K followers in 4 months without writing a single thread myself. The 6 AM brief is literally my entire content team now.',
    name: 'Amara Chen', role: 'AI Creator • 48K on X', initials: 'AC', grad: 'from-cyan-500 to-blue-600',
  },
  {
    quote: 'Our newsroom killed three paid tools the week we switched. Aggregation, summaries, scheduling — one agent does it all before our editors wake up.',
    name: 'Jonas Weber', role: 'Head of Digital, TechPulse', initials: 'JW', grad: 'from-violet-500 to-fuchsia-600',
  },
  {
    quote: 'The LinkedIn posts sound like me, only faster and better researched. Inbound leads from content tripled. Best $29 I spend every month.',
    name: 'Priya Nair', role: 'Founder, AgentStack', initials: 'PN', grad: 'from-emerald-500 to-teal-600',
  },
];

const FAQS = [
  { q: 'How does the AI agent actually work?', a: 'Every night the agent crawls 50+ vetted global sources, dedupes and scores stories by impact, summarizes them into a 3-minute brief, auto-formats native posts per channel (threads, carousels, professional takes), and publishes simultaneously at 6 AM. You can review, edit or approve everything from the dashboard — or run full autopilot.' },
  { q: 'Which sources do you aggregate from?', a: 'TechCrunch AI, MIT Technology Review, arXiv, The Verge, Wired, VentureBeat, key research labs\u2019 blogs, and vetted thought-leaders on X and LinkedIn — 50+ sources total. Pro and Newsroom plans let you add custom feeds and niche keywords.' },
  { q: 'Can I review posts before they go live?', a: 'Yes. Choose Full Autopilot (publishes automatically) or Approval Mode (brief lands in your inbox at 5:45 AM for one-tap approve/edit). Most creators start with approvals for a week, then flip to autopilot.' },
  { q: 'Will the posts sound like me?', a: 'The agent learns your voice from samples you provide plus engagement analytics — tone, length, emoji use, hashtag style. Newsroom plans support multiple brand voices and compliance review queues.' },
  { q: 'Is there really a free plan?', a: 'Yes — Starter is free forever: the daily 6 AM email brief plus posting to one channel. No credit card required. Upgrade to Pro when you want all six channels, visuals, and analytics.' },
];

export function Testimonials() {
  return (
    <section className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">Loved worldwide</p>
          <h2 className="font-display mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">Creators wake up <span className="text-gradient">to growth</span></h2>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-400">
            <span className="flex text-amber-300">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4" fill="currentColor" />)}</span>
            <span><strong className="text-white">4.9/5</strong> from 3,100+ reviews</span>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {QUOTES.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.08}>
              <figure className="flex h-full flex-col rounded-3xl border border-white/10 bg-[#0a0f1e]/80 p-6 transition hover:-translate-y-1 hover:border-white/20">
                <span className="flex text-amber-300">{Array.from({ length: 5 }).map((_, j) => <Star key={j} className="h-3.5 w-3.5" fill="currentColor" />)}</span>
                <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-slate-300">“{t.quote}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white ${t.grad}`}>{t.initials}</span>
                  <div>
                    <p className="flex items-center gap-1 text-sm font-semibold text-white">{t.name} <BadgeCheck className="h-4 w-4 text-cyan-300" /></p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="relative border-t border-white/[0.07] py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal className="text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-violet-300">FAQ</p>
          <h2 className="font-display mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">Questions, <span className="text-gradient">answered fast</span></h2>
        </Reveal>
        <div className="mt-10 space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} delay={i * 0.04}>
                <div className={`overflow-hidden rounded-2xl border transition-all ${isOpen ? 'border-cyan-400/30 bg-cyan-400/[0.04]' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}>
                  <button onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                    <span className={`text-[15px] font-semibold ${isOpen ? 'text-white' : 'text-slate-200'}`}>{f.q}</span>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${isOpen ? 'rotate-45 border-cyan-400/40 bg-cyan-400/15 text-cyan-300' : 'border-white/10 bg-white/5 text-slate-400'}`}>
                      <Plus className="h-4 w-4" />
                    </span>
                  </button>
                  <div className={`grid transition-all duration-300 ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm leading-relaxed text-slate-400">{f.a}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
