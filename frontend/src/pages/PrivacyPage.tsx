import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Zap } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Reveal from '../components/Reveal';

const SECTIONS = [
  { h: '1. Information We Collect', ps: ['Account information you provide directly — name, email address, and connected social-media account identifiers when you subscribe or start a trial.', 'Briefing preferences — topics, niches, delivery time, timezone, and brand-voice samples you upload.', 'Usage data collected automatically — pages visited, features used, device and browser type, approximate location (city-level), and interaction timestamps.', 'Content you submit — feedback, support messages, and posts you ask the agent to draft or schedule.'] },
  { h: '2. How We Use Your Information', ps: ['To operate the platform: aggregate news, generate your morning briefing, and publish scheduled posts to the social channels you connect.', 'To personalize: tune story ranking, summary tone, and posting schedule to your preferences.', 'To communicate: send briefs, product updates, security alerts, and support replies. Marketing emails always include an unsubscribe link.', 'To improve: analyze aggregated, de-identified usage patterns to train ranking models and improve summarization quality.'] },
  { h: '3. AI Processing & Third Parties', ps: ['Summaries are generated with leading large-language-model providers under data-processing agreements. Your content is never used to train public third-party models.', 'Publishing requires OAuth tokens for X, LinkedIn, Instagram, Facebook, YouTube, and Telegram. Tokens are encrypted at rest (AES-256) and you may revoke access at any time from your dashboard or the provider.', 'We share data only with infrastructure sub-processors (hosting, email delivery, analytics) bound by contract — never with advertisers or data brokers.'] },
  { h: '4. Cookies & Tracking', ps: ['We use strictly-necessary cookies for sign-in and security, plus privacy-friendly analytics to understand aggregate usage. No cross-site advertising trackers.', 'You can control cookies in your browser settings; core features remain available if you decline optional analytics.'] },
  { h: '5. Data Retention & Security', ps: ['Account data is retained while your account is active and for 30 days after deletion, then permanently erased except where law requires longer retention (e.g., billing records).', 'We apply encryption in transit (TLS 1.2+) and at rest, role-based access controls, audit logging, and annual penetration testing. No system is 100% secure, but we follow SOC 2-aligned practices.'] },
  { h: '6. Your Rights', ps: ['Depending on your region (GDPR, CCPA/CPRA, and similar laws), you may request access, correction, deletion, portability, or restriction of your personal data, and may opt out of marketing at any time.', 'To exercise these rights, email privacy@fastainews.ai. We respond within 30 days and never discriminate against users who exercise privacy rights.'] },
  { h: '7. Children', ps: ['Fast AI News is not directed at children under 13 (or the minimum age in your jurisdiction). We do not knowingly collect data from children; accounts discovered to belong to children are suspended and data deleted.'] },
  { h: '8. Changes & Contact', ps: ['We will notify you of material changes by email or in-app notice at least 14 days before they take effect. Continued use after the effective date constitutes acceptance.', 'Questions? Contact our Data Protection Officer at privacy@fastainews.ai or Fast AI News, Inc., 548 Market St, San Francisco, CA 94104.'] },
];

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="relative overflow-hidden pt-[68px]">
        <div className="bg-grid absolute inset-x-0 top-0 h-[480px]" />
        <div className="absolute left-1/2 top-0 h-72 w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(0,229,255,0.12),transparent_65%)] blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <Reveal>
            <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/40 hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to home
            </Link>
            <div className="mt-8 flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 shadow-lg">
                <ShieldCheck className="h-7 w-7 text-[#04060d]" />
              </span>
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Public Privacy Policy</p>
                <h1 className="font-display mt-1 text-3xl font-bold text-white sm:text-4xl">Privacy Policy</h1>
              </div>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <Zap className="h-4 w-4 text-cyan-300" /> Fast AI News • Effective September 1, 2026 • Last updated September 10, 2026
            </p>
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-relaxed text-slate-400">
              This public Privacy Policy explains what data Fast AI News (“we”, “us”) collects when you use our automated AI-news aggregation, summarization, and social-publishing platform — and the choices you have. Plain-language summary: <span className="font-semibold text-slate-200">we collect the minimum needed to run your briefings, never sell your data, and delete it when you leave.</span>
            </p>
          </Reveal>
          <div className="mt-8 space-y-4">
            {SECTIONS.map((s, i) => (
              <Reveal key={s.h} delay={Math.min(i * 0.04, 0.2)}>
                <section className="rounded-2xl border border-white/10 bg-[#0a0f1e]/80 p-6">
                  <h2 className="font-display text-lg font-bold text-white">{s.h}</h2>
                  <ul className="mt-3 space-y-2.5">
                    {s.ps.map((p, j) => (
                      <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-slate-400">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" /> {p}
                      </li>
                    ))}
                  </ul>
                </section>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:flex-row">
              <p className="text-sm text-slate-400">Prefer the short version? Read the <Link to="/terms" className="font-semibold text-cyan-300 hover:underline">Terms of Service</Link>.</p>
              <Link to="/" className="rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-6 py-2.5 text-sm font-bold text-[#04060d] transition hover:brightness-110">Back to Fast AI News</Link>
            </div>
          </Reveal>
        </div>
      </main>
      <Footer />
    </>
  );
}
