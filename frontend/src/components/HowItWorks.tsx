import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, BrainCircuit, CalendarClock, Rocket, Check } from 'lucide-react';
import Reveal from './Reveal';

const STEPS = [
  {
    icon: Radar,
    time: '04:30 AM — Scan',
    title: 'Aggregate from 50+ sources',
    desc: 'The agent crawls top global outlets, research feeds, papers and key voices on X. It dedupes 2,000+ raw hits down to the stories that actually matter.',
    bullets: ['50+ vetted global sources', 'Duplicate & spam filtering', 'Impact scoring per story'],
    gradient: 'from-cyan-400 to-sky-500',
    dot: 'bg-cyan-400',
  },
  {
    icon: BrainCircuit,
    time: '05:15 AM — Summarize',
    title: 'Summarize & curate the brief',
    desc: 'LLM summarization compresses each story into a punchy, jargon-free card — headline, 2-line takeaway, and why-it-matters — ranked for your niche.',
    bullets: ['Jargon-free 3-min summaries', 'Ranked by relevance to you', 'Sources linked & cited'],
    gradient: 'from-violet-400 to-purple-600',
    dot: 'bg-violet-400',
  },
  {
    icon: CalendarClock,
    time: '05:45 AM — Schedule',
    title: 'Auto-format & schedule',
    desc: 'One brief becomes six native posts: threads for X, carousels for Instagram, professional takes for LinkedIn. Hashtags, images and best-time slots handled.',
    bullets: ['Native format per channel', 'Auto visuals & hashtags', 'Best-time scheduling'],
    gradient: 'from-fuchsia-400 to-pink-500',
    dot: 'bg-fuchsia-400',
  },
  {
    icon: Rocket,
    time: '06:00 AM — Publish',
    title: 'Publish everywhere & grow',
    desc: 'Posts go live simultaneously across all channels while you sleep. Analytics flow back in, and the agent learns what your audience loves.',
    bullets: ['Simultaneous multi-posting', 'Inbox brief + live dashboard', 'Self-improving from analytics'],
    gradient: 'from-emerald-300 to-teal-500',
    dot: 'bg-emerald-300',
  },
];

export default function HowItWorks() {
  const [active, setActive] = useState(1);
  const step = STEPS[active];

  return (
    <section id="how-it-works" className="relative scroll-mt-20 overflow-hidden py-20 sm:py-24">
      <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-violet-600/10 blur-[120px]" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-violet-300">How it works</p>
          <h2 className="font-display mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
            Asleep at midnight. <span className="text-gradient">Viral by breakfast.</span>
          </h2>
          <p className="mt-4 text-base text-slate-400">Four autonomous steps run every night — zero manual work. Tap a step to see inside the machine.</p>
        </Reveal>

        {/* stepper */}
        <Reveal delay={0.1}>
          <div className="relative mx-auto mt-12 max-w-4xl">
            <div className="absolute left-[27px] top-4 bottom-4 w-px bg-white/10 sm:left-0 sm:right-0 sm:top-[27px] sm:bottom-auto sm:h-px sm:w-auto" />
            <div className="grid gap-3 sm:grid-cols-4 sm:gap-4">
              {STEPS.map((s, i) => {
                const isActive = i === active;
                return (
                  <button
                    key={s.title}
                    onClick={() => setActive(i)}
                    className={`relative flex items-center gap-4 rounded-2xl border p-3 text-left transition-all duration-300 sm:flex-col sm:items-start sm:p-4 ${isActive ? 'border-cyan-400/40 bg-cyan-400/[0.07] shadow-[0_0_28px_-6px_rgba(0,229,255,0.4)]' : 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.05]'}`}
                  >
                    <span className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${s.gradient} transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
                      <s.icon className="h-5 w-5 text-[#04060d]" strokeWidth={2.2} />
                    </span>
                    <span>
                      <span className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${isActive ? 'text-cyan-300' : 'text-slate-500'}`}>{s.time}</span>
                      <span className={`font-display mt-0.5 block text-sm font-bold leading-snug ${isActive ? 'text-white' : 'text-slate-300'}`}>{s.title}</span>
                    </span>
                    <span className={`absolute right-3 top-3 h-2 w-2 rounded-full ${s.dot} ${isActive ? 'animate-pulse' : 'opacity-40'}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* detail panel */}
        <div className="mx-auto mt-6 max-w-4xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
              className="neon-border overflow-hidden rounded-3xl bg-[#0a0f1e]/85 p-6 sm:p-8"
            >
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br ${step.gradient} shadow-lg`}>
                  <step.icon className="h-8 w-8 text-[#04060d]" strokeWidth={2} />
                </div>
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">{step.time}</p>
                  <h3 className="font-display mt-1 text-xl font-bold text-white sm:text-2xl">Step {active + 1}: {step.title}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-[15px]">{step.desc}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
                {step.bullets.map((b) => (
                  <div key={b} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15"><Check className="h-3 w-3 text-emerald-300" strokeWidth={3} /></span>
                    {b}
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
