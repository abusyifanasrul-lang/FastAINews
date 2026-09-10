import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Cpu, Briefcase, Landmark, Clock3, ArrowUpRight, Bookmark } from 'lucide-react';
import Reveal from './Reveal';

const CATS = [
  { id: 'all', label: 'All stories' },
  { id: 'models', label: 'Models' },
  { id: 'agents', label: 'Agents' },
  { id: 'business', label: 'Business' },
  { id: 'policy', label: 'Policy' },
];

const STORIES = [
  {
    cat: 'models', catLabel: 'Models', icon: Cpu, color: 'text-cyan-300', bg: 'bg-cyan-400/10', border: 'border-cyan-400/25',
    source: 'arXiv Daily • 2h ago', title: 'Open reasoning model beats GPT-class benchmark at 1/10th the size',
    take: 'A new 8B open-weights model tops reasoning charts — efficient architectures are closing the gap fast.',
    read: '2 min', hot: 98,
  },
  {
    cat: 'agents', catLabel: 'Agents', icon: Flame, color: 'text-fuchsia-300', bg: 'bg-fuchsia-400/10', border: 'border-fuchsia-400/25',
    source: 'TechCrunch AI • 4h ago', title: 'Autonomous coding agents now ship 40% of pull requests at top startups',
    take: 'Agents moved from demos to production — review pipelines, not code writing, are the new bottleneck.',
    read: '3 min', hot: 95,
  },
  {
    cat: 'business', catLabel: 'Business', icon: Briefcase, color: 'text-violet-300', bg: 'bg-violet-400/10', border: 'border-violet-400/25',
    source: 'The Verge • 6h ago', title: 'AI video startup hits $2B valuation 8 months after launch',
    take: 'Generative video is the new battleground — enterprise contracts are driving the frenzy.',
    read: '2 min', hot: 91,
  },
  {
    cat: 'policy', catLabel: 'Policy', icon: Landmark, color: 'text-emerald-300', bg: 'bg-emerald-400/10', border: 'border-emerald-400/25',
    source: 'MIT Review • 8h ago', title: 'Global AI safety accord signed by 28 nations in Geneva',
    take: 'Shared eval standards + incident reporting — compliance teams should read the fine print today.',
    read: '4 min', hot: 88,
  },
  {
    cat: 'models', catLabel: 'Models', icon: Cpu, color: 'text-cyan-300', bg: 'bg-cyan-400/10', border: 'border-cyan-400/25',
    source: 'X Thought-leaders • 9h ago', title: 'Multimodal models get real-time voice + vision at human latency',
    take: 'Sub-300ms voice-to-vision loops unlock a wave of realtime assistants and support agents.',
    read: '2 min', hot: 85,
  },
  {
    cat: 'business', catLabel: 'Business', icon: Briefcase, color: 'text-violet-300', bg: 'bg-violet-400/10', border: 'border-violet-400/25',
    source: 'Bloomberg Tech • 11h ago', title: 'AI chip prices drop 30% as supply floods the market',
    take: 'Inference just got dramatically cheaper — great news for anyone scaling agents in production.',
    read: '3 min', hot: 82,
  },
];

export default function Briefing() {
  const [cat, setCat] = useState('all');
  const [saved, setSaved] = useState<number[]>([]);
  const list = STORIES.filter((s) => cat === 'all' || s.cat === cat);

  const toggleSave = (i: number) => setSaved((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  return (
    <section id="briefing" className="relative scroll-mt-20 border-y border-white/[0.07] bg-[#070b16] py-20 sm:py-24">
      <div className="bg-grid absolute inset-0 opacity-60" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <Reveal className="max-w-2xl">
            <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Live briefing preview</p>
            <h2 className="font-display mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Tomorrow&apos;s brief, <span className="text-gradient">today&apos;s edge</span>
            </h2>
            <p className="mt-4 text-base text-slate-400">A taste of the 6 AM digest — aggregated, ranked and summarized by the agent. Filter by what moves your world.</p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="glass flex items-center gap-3 rounded-2xl border border-white/10 px-5 py-4">
              <span className="relative flex h-3 w-3">
                <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative h-3 w-3 rounded-full bg-emerald-400" />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-white">Brief #2,431 brewing…</p>
                <p className="font-mono text-xs text-slate-400">publishes in 07:12:44 • Sep 11, 6:00 AM</p>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.05}>
          <div className="mt-8 flex flex-wrap gap-2">
            {CATS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${cat === c.id ? 'bg-gradient-to-r from-cyan-400 to-violet-500 text-[#04060d] shadow-[0_0_24px_rgba(0,229,255,0.35)]' : 'border border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-400/30 hover:text-white'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </Reveal>

        <motion.div layout className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {list.map((s, i) => (
              <motion.article
                layout
                key={s.title}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="group flex flex-col rounded-3xl border border-white/10 bg-[#0a0f1e]/90 p-5 transition-all hover:-translate-y-1 hover:border-cyan-400/30 hover:shadow-[0_20px_50px_-16px_rgba(0,229,255,0.3)]"
              >
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${s.bg} ${s.border} ${s.color}`}>
                    <s.icon className="h-3 w-3" /> {s.catLabel}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[11px] text-orange-300"><Flame className="h-3 w-3" /> {s.hot}</span>
                </div>
                <p className="mt-3 font-mono text-[11px] text-slate-500">{s.source}</p>
                <h3 className="font-display mt-1.5 text-[15px] font-bold leading-snug text-white transition group-hover:text-cyan-100">{s.title}</h3>
                <p className="mt-2 flex-1 text-[13px] leading-relaxed text-slate-400"><span className="font-semibold text-cyan-300">Why it matters: </span>{s.take}</p>
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3.5">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" /> {s.read} read</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleSave(i)} aria-label="Bookmark" className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${saved.includes(i) ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-300' : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'}`}>
                      <Bookmark className="h-3.5 w-3.5" fill={saved.includes(i) ? 'currentColor' : 'none'} />
                    </button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:border-cyan-400/40 hover:text-white" aria-label="Open story">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
