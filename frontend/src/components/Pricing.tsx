import { useState } from 'react';
import { Check, Zap, Crown, Building2 } from 'lucide-react';
import Reveal from './Reveal';

const PLANS = [
  {
    icon: Zap,
    name: 'Starter',
    tagline: 'Taste the speed',
    monthly: 0,
    yearly: 0,
    cta: 'Start for free',
    featured: false,
    features: ['Daily 6 AM email brief', 'Top 10 stories, summarized', '1 social channel', '7-day archive', 'Community support'],
  },
  {
    icon: Crown,
    name: 'Pro Creator',
    tagline: 'Most popular — full autopilot',
    monthly: 29,
    yearly: 23,
    cta: 'Start 14-day free trial',
    featured: true,
    features: [
      'Everything in Starter',
      'All 6 social channels, auto-posted',
      'Unlimited briefs + niche filters',
      'AI visuals & hashtag engine',
      'Best-time scheduling',
      'Analytics dashboard',
      'Priority support',
    ],
  },
  {
    icon: Building2,
    name: 'Newsroom',
    tagline: 'For teams & media brands',
    monthly: 99,
    yearly: 79,
    cta: 'Talk to sales',
    featured: false,
    features: [
      'Everything in Pro',
      '5 seats + roles & approvals',
      'Custom branding & voice',
      'API + Zapier + webhooks',
      'White-label briefs',
      'Dedicated success manager',
    ],
  },
];

export default function Pricing() {
  const [yearly, setYearly] = useState(true);

  const scrollToCTA = () => document.getElementById('get-started')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section id="pricing" className="relative scroll-mt-20 border-t border-white/[0.07] bg-[#070b16] py-20 sm:py-24">
      <div className="absolute left-1/2 top-0 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(139,92,246,0.12),transparent_65%)] blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Pricing</p>
          <h2 className="font-display mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
            Cheaper than <span className="text-gradient">one hour of your time</span>
          </h2>
          <p className="mt-4 text-base text-slate-400">Start free. Upgrade when the followers roll in. Cancel anytime — keep your audience.</p>

          <div className="mt-7 inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] p-1.5">
            <button
              onClick={() => setYearly(false)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${!yearly ? 'bg-white text-[#04060d]' : 'text-slate-400 hover:text-white'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all ${yearly ? 'bg-gradient-to-r from-cyan-400 to-violet-500 text-[#04060d]' : 'text-slate-400 hover:text-white'}`}
            >
              Yearly <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${yearly ? 'bg-black/20 text-[#04060d]' : 'bg-emerald-400/15 text-emerald-300'}`}>−20%</span>
            </button>
          </div>
        </Reveal>

        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
          {PLANS.map((p, i) => {
            const price = yearly ? p.yearly : p.monthly;
            return (
              <Reveal key={p.name} delay={i * 0.08} className="h-full">
                <div className={`relative flex h-full flex-col rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1.5 ${p.featured ? 'neon-border bg-gradient-to-b from-[#0d1830] to-[#0a0f1e] shadow-[0_0_50px_-12px_rgba(0,229,255,0.4)]' : 'border border-white/10 bg-[#0a0f1e]/80 hover:border-white/20'}`}>
                  {p.featured && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-1 text-xs font-bold text-[#04060d] shadow-lg">
                      ⚡ MOST POPULAR
                    </span>
                  )}
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${p.featured ? 'bg-gradient-to-br from-cyan-400 to-violet-500' : 'bg-white/[0.06] ring-1 ring-white/10'}`}>
                      <p.icon className={`h-5 w-5 ${p.featured ? 'text-[#04060d]' : 'text-cyan-300'}`} />
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold text-white">{p.name}</h3>
                      <p className="text-xs text-slate-500">{p.tagline}</p>
                    </div>
                  </div>
                  <div className="mt-6 flex items-end gap-2">
                    <span className="font-display text-5xl font-bold tracking-tight text-white">${price}</span>
                    <span className="pb-1.5 text-sm text-slate-500">/ mo{yearly && price > 0 ? ', billed yearly' : ''}</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-3">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${p.featured ? 'bg-cyan-400/20' : 'bg-white/[0.06]'}`}>
                          <Check className={`h-3 w-3 ${p.featured ? 'text-cyan-300' : 'text-emerald-300'}`} strokeWidth={3} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={scrollToCTA}
                    className={`mt-7 w-full rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-[0.98] ${p.featured ? 'bg-gradient-to-r from-cyan-400 to-violet-500 text-[#04060d] hover:shadow-[0_0_32px_rgba(0,229,255,0.5)] hover:brightness-110' : 'border border-white/15 bg-white/[0.05] text-white hover:border-cyan-400/40 hover:bg-white/[0.08]'}`}
                  >
                    {p.cta}
                  </button>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.15}>
          <p className="mt-8 text-center text-sm text-slate-500">
            All paid plans include <span className="font-semibold text-slate-300">14-day free trial</span> • No credit card required • Cancel anytime
          </p>
        </Reveal>
      </div>
    </section>
  );
}
