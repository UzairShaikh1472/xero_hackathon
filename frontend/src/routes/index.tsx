import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UpFlowBrand } from "@/components/control-room/upflow-logo";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

// ── Dashboard mockup ─────────────────────────────────────────────────────────
function DashboardMockup() {
  return (
    <svg viewBox="0 0 900 520" xmlns="http://www.w3.org/2000/svg" className="w-full rounded-2xl" style={{ boxShadow: "var(--shadow-elevated)" }}>
      {/* bg */}
      <rect width="900" height="520" rx="16" fill="#f4f8fc" />
      {/* sidebar */}
      <rect x="0" y="0" width="200" height="520" rx="16" fill="#e2eefa" fillOpacity="0.9" />
      <rect x="16" y="24" width="80" height="22" rx="6" fill="#0e2f4d" />
      <rect x="16" y="70" width="168" height="34" rx="8" fill="#0e2f4d" fillOpacity="0.10" />
      <rect x="32" y="80" width="8" height="14" rx="2" fill="#0b1f33" fillOpacity="0.45" />
      <rect x="48" y="84" width="60" height="6" rx="3" fill="#0b1f33" fillOpacity="0.45" />
      <rect x="16" y="112" width="168" height="34" rx="8" fill="transparent" />
      <rect x="32" y="122" width="8" height="14" rx="2" fill="#0b1f33" fillOpacity="0.2" />
      <rect x="48" y="126" width="72" height="6" rx="3" fill="#0b1f33" fillOpacity="0.2" />
      <rect x="16" y="154" width="168" height="34" rx="8" fill="transparent" />
      <rect x="32" y="164" width="8" height="14" rx="2" fill="#0b1f33" fillOpacity="0.2" />
      <rect x="48" y="168" width="56" height="6" rx="3" fill="#0b1f33" fillOpacity="0.2" />
      {/* top bar */}
      <rect x="216" y="16" width="668" height="48" rx="10" fill="white" fillOpacity="0.7" />
      <rect x="232" y="26" width="100" height="10" rx="5" fill="#0b1f33" fillOpacity="0.5" />
      <rect x="232" y="42" width="60" height="6" rx="3" fill="#0b1f33" fillOpacity="0.2" />
      {/* KPI row */}
      <rect x="216" y="80" width="155" height="90" rx="12" fill="white" fillOpacity="0.85" />
      <rect x="232" y="96" width="60" height="6" rx="3" fill="#0b1f33" fillOpacity="0.3" />
      <rect x="232" y="114" width="90" height="20" rx="4" fill="#0e2f4d" fillOpacity="0.85" />
      <rect x="232" y="142" width="110" height="6" rx="3" fill="#0b1f33" fillOpacity="0.15" />
      <rect x="383" y="80" width="155" height="90" rx="12" fill="white" fillOpacity="0.85" />
      <rect x="399" y="96" width="80" height="6" rx="3" fill="#e58b1a" fillOpacity="0.6" />
      <rect x="399" y="114" width="90" height="20" rx="4" fill="#e58b1a" />
      <rect x="399" y="142" width="110" height="6" rx="3" fill="#0b1f33" fillOpacity="0.15" />
      <rect x="399" y="154" width="70" height="14" rx="7" fill="#e58b1a" fillOpacity="0.14" />
      <rect x="551" y="80" width="155" height="90" rx="12" fill="white" fillOpacity="0.85" />
      <rect x="567" y="96" width="100" height="6" rx="3" fill="#149f67" fillOpacity="0.5" />
      <rect x="567" y="114" width="80" height="20" rx="4" fill="#149f67" />
      <rect x="567" y="142" width="110" height="6" rx="3" fill="#0b1f33" fillOpacity="0.15" />
      <rect x="567" y="154" width="80" height="14" rx="7" fill="#149f67" fillOpacity="0.12" />
      <rect x="719" y="80" width="165" height="90" rx="12" fill="white" fillOpacity="0.85" stroke="#2ac8f6" strokeWidth="1.5" />
      <rect x="735" y="96" width="80" height="6" rx="3" fill="#0b1f33" fillOpacity="0.3" />
      <rect x="735" y="114" width="100" height="20" rx="4" fill="#0e2f4d" fillOpacity="0.85" />
      <rect x="735" y="142" width="110" height="6" rx="3" fill="#0b1f33" fillOpacity="0.15" />
      {/* section label */}
      <rect x="216" y="190" width="120" height="12" rx="6" fill="#0b1f33" fillOpacity="0.4" />
      {/* follow-up cols */}
      <rect x="216" y="215" width="210" height="285" rx="12" fill="white" fillOpacity="0.75" />
      <rect x="232" y="230" width="40" height="6" rx="3" fill="#0b1f33" fillOpacity="0.2" />
      <rect x="232" y="242" width="80" height="10" rx="4" fill="#0b1f33" fillOpacity="0.6" />
      <rect x="232" y="260" width="176" height="1" fill="#0b1f33" fillOpacity="0.08" />
      {[0,1,2,3].map(i => (
        <g key={i}>
          <rect x="232" y={272 + i * 54} width="176" height="46" rx="8" fill="#f4f8fc" />
          <circle cx="246" cy={289 + i * 54} r="5" fill="#e58b1a" fillOpacity="0.8" />
          <rect x="256" y={285 + i * 54} width="80" height="7" rx="3" fill="#0b1f33" fillOpacity="0.5" />
          <rect x="256" y={297 + i * 54} width="50" height="5" rx="2" fill="#0b1f33" fillOpacity="0.2" />
          <rect x="336" y={285 + i * 54} width="56" height="18" rx="6" fill="#0b1f33" fillOpacity="0.06" />
        </g>
      ))}
      <rect x="438" y="215" width="210" height="285" rx="12" fill="white" fillOpacity="0.75" />
      <rect x="454" y="230" width="40" height="6" rx="3" fill="#0b1f33" fillOpacity="0.2" />
      <rect x="454" y="242" width="100" height="10" rx="4" fill="#0b1f33" fillOpacity="0.6" />
      <rect x="454" y="260" width="176" height="1" fill="#0b1f33" fillOpacity="0.08" />
      {[0,1].map(i => (
        <g key={i}>
          <rect x="454" y={272 + i * 54} width="176" height="46" rx="8" fill="#f4f8fc" />
          <circle cx="468" cy={289 + i * 54} r="5" fill="#e5484d" fillOpacity="0.75" />
          <rect x="478" y={285 + i * 54} width="80" height="7" rx="3" fill="#0b1f33" fillOpacity="0.5" />
          <rect x="478" y={297 + i * 54} width="60" height="5" rx="2" fill="#0b1f33" fillOpacity="0.2" />
          <rect x="558" y={285 + i * 54} width="56" height="18" rx="6" fill="#0b1f33" fillOpacity="0.06" />
        </g>
      ))}
      <rect x="660" y="215" width="224" height="285" rx="12" fill="white" fillOpacity="0.75" />
      <rect x="676" y="230" width="40" height="6" rx="3" fill="#0b1f33" fillOpacity="0.2" />
      <rect x="676" y="242" width="110" height="10" rx="4" fill="#0b1f33" fillOpacity="0.6" />
      <rect x="676" y="260" width="192" height="1" fill="#0b1f33" fillOpacity="0.08" />
      {[0,1,2].map(i => (
        <g key={i}>
          <rect x="676" y={272 + i * 54} width="192" height="46" rx="8" fill="#f4f8fc" />
          <circle cx="692" cy={289 + i * 54} r="5" fill="#149f67" fillOpacity="0.8" />
          <rect x="704" y={285 + i * 54} width="100" height="7" rx="3" fill="#0b1f33" fillOpacity="0.5" />
          <rect x="704" y={297 + i * 54} width="70" height="5" rx="2" fill="#0b1f33" fillOpacity="0.2" />
          <rect x="792" y={285 + i * 54} width="60" height="18" rx="6" fill="#0b1f33" fillOpacity="0.06" />
        </g>
      ))}
    </svg>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="panel flex flex-col items-center gap-1 px-6 py-4 text-center">
      <span className="numeric text-2xl font-semibold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Gradient glow backdrop */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: "var(--gradient-glow)" }}
      />

      {/* Nav */}
      <header className="sticky top-0 z-10 border-b hairline bg-surface/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <UpFlowBrand size={34} textClassName="text-lg" />
              <div className="truncate text-sm text-muted-foreground">
                Your cash control room · <span className="text-foreground">Built on Xero</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</a>
            <Link to="/login">
              <Button size="sm" style={{ boxShadow: "var(--shadow-neon)" }}>Sign in</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 pt-20 pb-6 text-center">
        <div className="mx-auto max-w-[640px] space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border hairline bg-surface px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="inline-block size-1.5 rounded-full bg-accent" />
            Built on Xero
          </div>
          <h1 className="text-5xl font-semibold tracking-tight leading-[1.1] text-foreground">
            Your cash picture,<br />ready to act on.
          </h1>
          <p className="mx-auto max-w-md text-lg text-muted-foreground">
            Connect Xero. See which invoices are worth chasing and which customers are worth nurturing. Send AI-drafted follow-ups in one click.
          </p>
          <Link to="/login">
            <Button size="lg" className="gap-2" style={{ boxShadow: "var(--shadow-neon)" }}>
              Login <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Dashboard mockup */}
      <section className="px-6 pb-4">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-4 grid max-w-lg grid-cols-3 gap-3 mx-auto">
            <StatPill value="£34k" label="recoverable cash" />
            <StatPill value="13" label="overdue invoices" />
            <StatPill value="1-click" label="to send follow-up" />
          </div>
          <DashboardMockup />
        </div>
      </section>

      {/* Steps */}
      <section className="border-t hairline px-6 py-16">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="mb-10 text-3xl font-semibold tracking-tight text-foreground">Up and running in three steps</h2>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Step 1 */}
            <div className="panel overflow-hidden flex flex-col">
              <div className="px-8 pt-8 pb-0 flex justify-center" style={{ background: "linear-gradient(135deg, #0e2f4d 0%, #163d60 100%)" }}>
                <svg viewBox="0 0 280 180" className="w-full max-w-[280px]" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="10" y="10" width="260" height="170" rx="12" fill="#0a2540"/>
                  <rect x="10" y="10" width="260" height="32" rx="12" fill="#0e2f4d"/>
                  <rect x="10" y="30" width="260" height="12" fill="#0e2f4d"/>
                  <circle cx="28" cy="26" r="5" fill="#ff5f57"/><circle cx="44" cy="26" r="5" fill="#febc2e"/><circle cx="60" cy="26" r="5" fill="#28c840"/>
                  <rect x="80" y="18" width="120" height="16" rx="8" fill="#163d60"/>
                  <rect x="80" y="58" width="120" height="40" rx="10" fill="#13B5EA" opacity="0.15"/>
                  <text x="140" y="83" textAnchor="middle" fill="#13B5EA" fontSize="18" fontWeight="700">xero</text>
                  <rect x="55" y="110" width="170" height="56" rx="10" fill="#fff" opacity="0.06"/>
                  <rect x="70" y="122" width="140" height="10" rx="5" fill="#fff" opacity="0.15"/>
                  <rect x="70" y="138" width="140" height="20" rx="6" fill="#2ac8f6" opacity="0.9"/>
                  <text x="140" y="152" textAnchor="middle" fill="#0e2f4d" fontSize="10" fontWeight="600">Authorise UpFlow →</text>
                </svg>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="mb-2 flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">1</div>
                <h3 className="font-semibold text-foreground">Connect Xero in seconds</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  One OAuth click — your invoices and payment history sync instantly, no exports needed.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="panel overflow-hidden flex flex-col">
              <div className="px-6 pt-8 pb-0 flex justify-center" style={{ background: "var(--color-surface-2)" }}>
                <svg viewBox="0 0 280 180" className="w-full max-w-[280px]" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="10" y="10" width="260" height="170" rx="12" fill="white" fillOpacity="0.8"/>
                  <rect x="10" y="10" width="260" height="28" rx="12" fill="#e2eefa"/>
                  <rect x="10" y="26" width="260" height="12" fill="#e2eefa"/>
                  <rect x="20" y="16" width="50" height="10" rx="5" fill="#0b1f33" opacity="0.5"/>
                  <rect x="20" y="50" width="70" height="42" rx="8" fill="#f4f8fc"/>
                  <rect x="26" y="67" width="50" height="12" rx="3" fill="#0b1f33" opacity="0.7"/>
                  <rect x="100" y="50" width="70" height="42" rx="8" fill="#f4f8fc"/>
                  <rect x="106" y="67" width="48" height="12" rx="3" fill="#e58b1a"/>
                  <rect x="180" y="50" width="70" height="42" rx="8" fill="#f4f8fc"/>
                  <rect x="186" y="67" width="45" height="12" rx="3" fill="#149f67"/>
                  <rect x="20" y="105" width="240" height="1" fill="#c8dcf0"/>
                  {[0,1,2].map(i => (
                    <g key={i}>
                      <circle cx="32" cy={120 + i * 18} r="4" fill={["#e5484d","#e58b1a","#149f67"][i]} opacity="0.85"/>
                      <rect x="44" y={116 + i * 18} width="100" height="5" rx="2" fill="#0b1f33" opacity="0.4"/>
                      <rect x="212" y={113 + i * 18} width="38" height="11" rx="5" fill="#0b1f33" opacity="0.06"/>
                    </g>
                  ))}
                </svg>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="mb-2 flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">2</div>
                <h3 className="font-semibold text-foreground">See your full cash picture</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Overdue, loyalty, and reactivation — three live lenses on your cash, all ranked by impact.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-1.5">
                  <div className="flex items-center gap-2.5 rounded-xl bg-surface-2/60 px-3 py-2">
                    <div className="shrink-0 rounded-md bg-warning/10 p-1">
                      <svg className="size-3.5 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                    <span className="text-xs font-medium">Overdue — ranked by recoverable cash</span>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl bg-surface-2/60 px-3 py-2">
                    <div className="shrink-0 rounded-md bg-positive/10 p-1">
                      <svg className="size-3.5 text-positive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                    </div>
                    <span className="text-xs font-medium">Loyalty — repeat buyers ready for upsell</span>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl bg-surface-2/60 px-3 py-2">
                    <div className="shrink-0 rounded-md bg-info/10 p-1">
                      <svg className="size-3.5 text-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                    </div>
                    <span className="text-xs font-medium">Reactivation — lapsed customers gone quiet</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="panel overflow-hidden flex flex-col">
              <div className="px-6 pt-8 pb-0 flex justify-center" style={{ background: "linear-gradient(135deg, #eaf6f0 0%, #d6f0e8 100%)" }}>
                <svg viewBox="0 0 280 180" className="w-full max-w-[280px]" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs><filter id="sh2"><feDropShadow dx="0" dy="2" stdDeviation="6" floodColor="#0b1f33" floodOpacity="0.08"/></filter></defs>
                  <rect x="20" y="16" width="240" height="148" rx="12" fill="white" fillOpacity="0.9" filter="url(#sh2)"/>
                  <rect x="32" y="28" width="60" height="6" rx="3" fill="#0b1f33" opacity="0.15"/>
                  <rect x="32" y="40" width="160" height="8" rx="4" fill="#0b1f33" opacity="0.7"/>
                  <rect x="32" y="58" width="216" height="5" rx="2" fill="#0b1f33" opacity="0.12"/>
                  <rect x="32" y="68" width="180" height="5" rx="2" fill="#0b1f33" opacity="0.12"/>
                  <rect x="32" y="78" width="200" height="5" rx="2" fill="#0b1f33" opacity="0.12"/>
                  <rect x="32" y="108" width="100" height="28" rx="8" fill="#0e2f4d"/>
                  <text x="82" y="127" textAnchor="middle" fill="white" fontSize="10" fontWeight="700">✓ Approve & Send</text>
                  <rect x="142" y="108" width="106" height="28" rx="8" fill="#e2eefa"/>
                  <text x="195" y="127" textAnchor="middle" fill="#0b1f33" fontSize="10" fontWeight="500">Edit draft</text>
                  <text x="140" y="155" textAnchor="middle" fill="#149f67" fontSize="8">Email sent to Acme Corp ✓</text>
                </svg>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="mb-2 flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">3</div>
                <h3 className="font-semibold text-foreground">Act with one click</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Approve an AI-drafted email in one click — unanswered? It escalates automatically to a call or human handoff.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-1.5">
                  <div className="flex items-center gap-2.5 rounded-xl bg-surface-2/60 px-3 py-2">
                    <div className="shrink-0 rounded-md bg-surface-2 p-1">
                      <svg className="size-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>
                    </div>
                    <span className="text-xs font-medium">AI-drafted email follow-ups</span>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl bg-surface-2/60 px-3 py-2">
                    <div className="shrink-0 rounded-md bg-surface-2 p-1">
                      <svg className="size-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.8A16 16 0 0 0 14 14.87l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7a2 2 0 0 1 1.72 2.01z"/></svg>
                    </div>
                    <span className="text-xs font-medium">Escalation to AI agent call if unpaid</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="border-t hairline px-6 py-16">
        <div className="mx-auto max-w-[1100px]">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 items-start">
            <div className="space-y-4">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">Get in touch</h2>
              <p className="text-muted-foreground">
                UpFlow is currently available as a demo. If you're a Xero user and want early access, or you'd like to see a live walkthrough with your own data, drop us a message and we'll get back to you within one business day.
              </p>
              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 rounded-lg bg-surface-2 p-2">
                    <svg className="size-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Early access</div>
                    <div className="text-sm text-muted-foreground">Get on the waitlist and be first to connect your Xero account.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 rounded-lg bg-surface-2 p-2">
                    <svg className="size-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.8A16 16 0 0 0 14 14.87l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7a2 2 0 0 1 1.72 2.01z"/></svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Live demo</div>
                    <div className="text-sm text-muted-foreground">See UpFlow running against your own Xero data in a 20-minute call.</div>
                  </div>
                </div>
              </div>
            </div>
            <ContactForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t hairline px-6 py-6">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between">
          <UpFlowBrand size={20} textClassName="text-sm" />
          <span className="text-sm text-muted-foreground">Built on Xero</span>
        </div>
      </footer>
    </div>
  );
}

function ContactForm() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  if (sent) {
    return (
      <div className="panel flex flex-col items-center gap-4 p-10 text-center">
        <CheckCircle className="size-10 text-positive" />
        <div className="font-semibold">Message sent!</div>
        <p className="text-sm text-muted-foreground">We'll get back to you within one business day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="panel space-y-5 p-8">
      <div>
        <label className="mb-1.5 block text-sm font-medium">Name</label>
        <Input placeholder="Jane Smith" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Email</label>
        <Input type="email" placeholder="jane@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Message</label>
        <Textarea placeholder="Tell us what you're trying to solve…" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
      </div>
      <Button type="submit" className="w-full" size="lg">Send message</Button>
    </form>
  );
}
