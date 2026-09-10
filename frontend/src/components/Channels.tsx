import Reveal from './Reveal';
import { Twitter, Linkedin, Instagram, Facebook, Youtube, Send, Wand2, ImagePlus, Hash, Clock3 } from 'lucide-react';

const CHANNELS = [
  { icon: Twitter, name: 'X / Twitter', desc: 'Auto-threads + hooks', followers: '2.1M posts/mo', grad: 'from-sky-400 to-blue-600' },
  { icon: Linkedin, name: 'LinkedIn', desc: 'Professional takes', followers: '890K posts/mo', grad: 'from-blue-500 to-indigo-600' },
  { icon: Instagram, name: 'Instagram', desc: 'Carousels + reels copy', followers: '1.4M posts/mo', grad: 'from-fuchsia-400 to-orange-400' },
  { icon: Facebook, name: 'Facebook', desc: 'Community-ready posts', followers: '760K posts/mo', grad: 'from-indigo-400 to-blue-500' },
  { icon: Youtube, name: 'YouTube', desc: 'Shorts scripts + titles', followers: '420K posts/mo', grad: 'from-rose-400 to-red-600' },
  { icon: Send, name: 'Telegram', desc: 'Instant brief drops', followers: '980K posts/mo', grad: 'from-cyan-400 to-sky-600' },
];

const PERKS = [
  { icon: Wand2, title: 'Native formatting', desc: 'Character limits, thread splits & carousel slides handled per platform.' },
  { icon: ImagePlus, title: 'Auto visuals', desc: 'AI-generated cover art + branded templates attached to every post.' },
  { icon: Hash, title: 'Smart hashtags', desc: 'Trending-tag engine tunes reach without looking spammy.' },
  { icon: Clock3, title: 'Best-time engine', desc: 'Publishes at peak engagement windows, per channel, per timezone.' },
];

export default function Channels() {
  return (
    <section id="channels" className="relative scroll-mt-20 overflow-hidden py-20 sm:py-24">
      <div className="absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-cyan-500/10 blur-[130px]" />
      <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-violet-600/10 blur-[130px]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-fuchsia-300">Omnichannel posting</p>
          <h2 className="font-display mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
            Write once. <span className="text-gradient">Dominate everywhere.</span>
          </h2>
          <p className="mt-4 text-base text-slate-400">One morning brief fans out into six perfectly-formatted posts — published simultaneously, while you drink coffee.</p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHANNELS.map((c, i) => (
            <Reveal key={c.name} delay={(i % 3) * 0.07}>
              <div className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0a0f1e]/80 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/30 hover:shadow-[0_18px_50px_-16px_rgba(0,229,255,0.35)]">
                <span className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${c.grad} p-3.5 shadow-lg`}>
                  <c.icon className="h-6 w-6 text-white" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-white">{c.name}</p>
                  <p className="truncate text-sm text-slate-400">{c.desc}</p>
                </div>
                <div className="text-right">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">{c.followers}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PERKS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06}>
              <div className="h-full rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition hover:border-white/20 hover:bg-white/[0.04]">
                <p.icon className="h-5 w-5 text-cyan-300" />
                <p className="font-display mt-3 text-sm font-bold text-white">{p.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
