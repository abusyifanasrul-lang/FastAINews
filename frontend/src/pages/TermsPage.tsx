import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Zap } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Reveal from '../components/Reveal';

const SECTIONS = [
  { h: '1. The Service', ps: ['Fast AI News provides an automated AI-agent platform that aggregates public AI news, generates summarized morning briefings, and — at your direction — formats, schedules, and publishes posts to third-party social-media channels you connect.', 'You must be at least 13 years old (or the age of digital consent in your jurisdiction) and able to form a binding contract to use the service.'] },
  { h: '2. Accounts & Plans', ps: ['Starter (free), Pro Creator, and Newsroom plans are billed as described on the pricing page. Paid plans include a 14-day free trial; no card is charged until the trial ends and you may cancel in one click.', 'You are responsible for keeping your credentials confidential and for all activity under your account. Notify support@fastainews.ai immediately of unauthorized use.', 'Team seats (Newsroom) may invite members under your organization\u2019s responsibility; you control roles, approvals, and revocation.'] },
  { h: '3. Acceptable Use', ps: ['You agree not to: violate any law; infringe intellectual-property or privacy rights; upload malware; attempt to disrupt, scrape, or reverse-engineer the platform; or use briefings to generate spam, misinformation, or harassing content.', 'Automated publishing must comply with each connected platform\u2019s terms (X, LinkedIn, Meta, Google/YouTube, Telegram). We may pause publishing if a provider flags abuse — and will notify you promptly.'] },
  { h: '4. Content & Intellectual Property', ps: ['Your inputs (preferences, voice samples, edits) remain yours. You grant us a limited license to process them solely to operate and improve the service for you.', 'Briefings summarize third-party news with citations and links. Headlines and excerpts belong to their publishers; summaries are transformative digests, not reproductions. Always review auto-generated posts before relying on them for legal, medical, or financial decisions.', 'The platform, models, templates, and branding are owned by Fast AI News, Inc. and licensed — not sold — to you during your subscription.'] },
  { h: '5. AI Disclaimer', ps: ['AI summaries may occasionally contain errors or omissions. We target high accuracy with source citations, but you are responsible for verifying facts before republishing. Enable Approval Mode if your brand requires human review.', 'Service availability target is 99.5% monthly; scheduled maintenance windows are announced 48 hours in advance. The 6 AM brief is delivered in the timezone you configure.'] },
  { h: '6. Payments, Cancellation & Refunds', ps: ['Subscriptions renew automatically until cancelled. Cancel anytime from Settings → Billing; access continues until the end of the paid period.', 'Yearly plans cancelled within 30 days receive a pro-rated refund; monthly plans are non-refundable after the trial except where required by law. Chargebacks should first be raised with support@fastainews.ai for fast resolution.'] },
  { h: '7. Termination', ps: ['Either party may terminate at any time. We may suspend accounts for material breach, non-payment, or abuse, with notice and a 7-day cure period where feasible.', 'On termination, scheduled posts are cancelled, OAuth tokens revoked, and account data deleted within 30 days (billing records retained per tax law). You may export your briefings and analytics before deletion.'] },
  { h: '8. Liability, Governing Law & Contact', ps: ['To the maximum extent permitted by law, the service is provided “as is”; our aggregate liability is limited to fees paid in the prior 12 months. Nothing limits liability for fraud, willful misconduct, or rights that cannot be waived by law.', 'These terms are governed by the laws of California, USA, with exclusive venue in San Francisco County, except where consumer-protection law grants you other rights.', 'Contact: legal@fastainews.ai • Fast AI News, Inc., 548 Market St, San Francisco, CA 94104. Material changes take effect 14 days after notice.'] },
];

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="relative overflow-hidden pt-[68px]">
        <div className="bg-grid absolute inset-x-0 top-0 h-[480px]" />
        <div className="absolute left-1/2 top-0 h-72 w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(139,92,246,0.14),transparent_65%)] blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <Reveal>
            <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-violet-400/40 hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to home
            </Link>
            <div className="mt-8 flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-fuchsia-500 shadow-lg">
                <FileText className="h-7 w-7 text-[#04060d]" />
              </span>
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-violet-300">Public Terms of Service</p>
                <h1 className="font-display mt-1 text-3xl font-bold text-white sm:text-4xl">Terms of Service</h1>
              </div>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <Zap className="h-4 w-4 text-violet-300" /> Fast AI News • Effective September 1, 2026 • Last updated September 10, 2026
            </p>
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-relaxed text-slate-400">
              These public Terms of Service form the agreement between you and Fast AI News, Inc. for the automated news-aggregation and social-publishing platform. Plain-language summary: <span className="font-semibold text-slate-200">use the agent fairly, you own your inputs, review AI output before high-stakes use, and you can cancel anytime.</span>
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
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" /> {p}
                      </li>
                    ))}
                  </ul>
                </section>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:flex-row">
              <p className="text-sm text-slate-400">How we handle your data: <Link to="/privacy" className="font-semibold text-cyan-300 hover:underline">Privacy Policy</Link>.</p>
              <Link to="/" className="rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-6 py-2.5 text-sm font-bold text-[#04060d] transition hover:brightness-110">Back to Fast AI News</Link>
            </div>
          </Reveal>
        </div>
      </main>
      <Footer />
    </>
  );
}
