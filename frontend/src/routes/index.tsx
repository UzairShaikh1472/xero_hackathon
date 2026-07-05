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

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b hairline bg-background/80 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between">
          <UpFlowBrand size={28} textClassName="text-base" />
          <div className="flex items-center gap-3">
            <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</a>
            <Link to="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 pt-20 pb-6 text-center">
        <div className="mx-auto max-w-[640px] space-y-5">
          <h1 className="text-5xl font-semibold tracking-tight leading-[1.1]">
            Your cash picture,<br />ready to act on.
          </h1>
          <p className="mx-auto max-w-md text-lg text-muted-foreground">
            Connect Xero. See which invoices are worth chasing and which customers are worth nurturing. Send AI-drafted follow-ups in one click.
          </p>
          <Link to="/login">
            <Button size="lg" className="gap-2">
              Login <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Steps */}
      <section className="border-t hairline px-6 py-16">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="mb-10 text-3xl font-semibold tracking-tight">Up and running in three steps</h2>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Step 1 */}
            <div className="rounded-3xl bg-white overflow-hidden flex flex-col">
              <div className="bg-[#1a1a1a] px-8 pt-8 pb-0 flex justify-center">
                <svg viewBox="0 0 280 180" className="w-full max-w-[280px]" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="10" y="10" width="260" height="170" rx="12" fill="#2a2a2a"/>
                  <rect x="10" y="10" width="260" height="32" rx="12" fill="#333"/>
                  <rect x="10" y="30" width="260" height="12" fill="#333"/>
                  <circle cx="28" cy="26" r="5" fill="#ff5f57"/><circle cx="44" cy="26" r="5" fill="#febc2e"/><circle cx="60" cy="26" r="5" fill="#28c840"/>
                  <rect x="80" y="18" width="120" height="16" rx="8" fill="#444"/>
                  <rect x="80" y="58" width="120" height="40" rx="10" fill="#13B5EA" opacity="0.15"/>
                  <text x="140" y="83" textAnchor="middle" fill="#13B5EA" fontSize="18" fontWeight="700">xero</text>
                  <rect x="55" y="110" width="170" height="56" rx="10" fill="#fff" opacity="0.07"/>
                  <rect x="70" y="122" width="140" height="10" rx="5" fill="#fff" opacity="0.15"/>
                  <rect x="70" y="138" width="140" height="20" rx="6" fill="#a3e635" opacity="0.9"/>
                  <text x="140" y="152" textAnchor="middle" fill="#1a1a1a" fontSize="10" fontWeight="600">Authorise UpFlow →</text>
                </svg>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="mb-2 flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">1</div>
                <h3 className="font-semibold">Connect Xero in seconds</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  One OAuth click — your invoices and payment history sync instantly, no exports needed.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-3xl bg-white overflow-hidden flex flex-col">
              <div className="bg-[#f5f4f0] px-6 pt-8 pb-0 flex justify-center">
                <svg viewBox="0 0 280 180" className="w-full max-w-[280px]" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="10" y="10" width="260" height="170" rx="12" fill="white"/>
                  <rect x="10" y="10" width="260" height="28" rx="12" fill="#eceae4"/>
                  <rect x="10" y="26" width="260" height="12" fill="#eceae4"/>
                  <rect x="20" y="16" width="50" height="10" rx="5" fill="#1a1a1a" opacity="0.5"/>
                  <rect x="20" y="50" width="70" height="42" rx="8" fill="#f5f4f0"/>
                  <rect x="26" y="67" width="50" height="12" rx="3" fill="#1a1a1a" opacity="0.7"/>
                  <rect x="100" y="50" width="70" height="42" rx="8" fill="#f5f4f0"/>
                  <rect x="106" y="67" width="48" height="12" rx="3" fill="#c07b00"/>
                  <rect x="180" y="50" width="70" height="42" rx="8" fill="#f5f4f0"/>
                  <rect x="186" y="67" width="45" height="12" rx="3" fill="#2d7a4a"/>
                  <rect x="20" y="105" width="240" height="1" fill="#eceae4"/>
                  {[0,1,2].map(i => (
                    <g key={i}>
                      <circle cx="32" cy={120 + i * 18} r="4" fill={["#ef4444","#c07b00","#2d7a4a"][i]} opacity="0.8"/>
                      <rect x="44" y={116 + i * 18} width="100" height="5" rx="2" fill="#1a1a1a" opacity="0.4"/>
                      <rect x="212" y={113 + i * 18} width="38" height="11" rx="5" fill="#1a1a1a" opacity="0.07"/>
                    </g>
                  ))}
                </svg>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="mb-2 flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">2</div>
                <h3 className="font-semibold">See your full cash picture</h3>
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
            <div className="rounded-3xl bg-white overflow-hidden flex flex-col">
              <div className="bg-[#f0fdf4] px-6 pt-8 pb-0 flex justify-center">
                <svg viewBox="0 0 280 180" className="w-full max-w-[280px]" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs><filter id="sh2"><feDropShadow dx="0" dy="2" stdDeviation="6" floodColor="#000" floodOpacity="0.08"/></filter></defs>
                  <rect x="20" y="16" width="240" height="148" rx="12" fill="white" filter="url(#sh2)"/>
                  <rect x="32" y="28" width="60" height="6" rx="3" fill="#1a1a1a" opacity="0.15"/>
                  <rect x="32" y="40" width="160" height="8" rx="4" fill="#1a1a1a" opacity="0.7"/>
                  <rect x="32" y="58" width="216" height="5" rx="2" fill="#1a1a1a" opacity="0.12"/>
                  <rect x="32" y="68" width="180" height="5" rx="2" fill="#1a1a1a" opacity="0.12"/>
                  <rect x="32" y="78" width="200" height="5" rx="2" fill="#1a1a1a" opacity="0.12"/>
                  <rect x="32" y="108" width="100" height="28" rx="8" fill="#a3e635"/>
                  <text x="82" y="127" textAnchor="middle" fill="#1a1a1a" fontSize="10" fontWeight="700">✓ Approve & Send</text>
                  <rect x="142" y="108" width="106" height="28" rx="8" fill="#f5f4f0"/>
                  <text x="195" y="127" textAnchor="middle" fill="#1a1a1a" fontSize="10" fontWeight="500">Edit draft</text>
                  <text x="140" y="155" textAnchor="middle" fill="#2d7a4a" fontSize="8">Email sent to Acme Corp ✓</text>
                </svg>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="mb-2 flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">3</div>
                <h3 className="font-semibold">Act with one click</h3>
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
              <h2 className="text-3xl font-semibold tracking-tight">Get in touch</h2>
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
