import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  AudioWaveform,
  Banknote,
  Landmark,
  Mail,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { countFollowUps } from "@/lib/kinetic/follow-up";
import { gbp } from "@/lib/kinetic/format";
import type { ControlRoomData } from "@/lib/kinetic/types";

const chartConfig = {
  balance: {
    label: "Cash balance",
    color: "var(--primary)",
  },
};

export function WelcomeHero({ data }: { data: ControlRoomData }) {
  const followUpCount = countFollowUps(data.drafts);
  const chartData = data.liquidity.daily.map((d) => ({
    day: d.day,
    balance: d.balance,
  }));
  const projectedBalance =
    chartData[chartData.length - 1]?.balance ?? data.snapshot.currentCash;
  const overdueInvoices = data.atRiskInvoices.filter((item) => item.daysOverdue > 0);
  const topInvoices = overdueInvoices.slice(0, 3);
  const estimatedRecovery = topInvoices.reduce(
    (sum, item) => sum + item.expectedRecovery,
    0,
  );
  const emailReady = data.drafts.filter((draft) => (draft.daysOverdue ?? 0) < 14).length;
  const voiceReady = data.drafts.filter((draft) => (draft.daysOverdue ?? 0) >= 14).length;

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 px-4 pb-10 pt-3 sm:px-6 sm:pb-14 sm:pt-5">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="panel relative overflow-hidden p-7 sm:p-9">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(55,193,255,0.16),transparent_68%)]" />

          <div className="relative space-y-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sky-200/80 bg-sky-50/92 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                Main entry
              </span>
              <span className="rounded-full border border-white/80 bg-white/72 px-3 py-1 text-xs text-muted-foreground">
                Connected to {data.snapshot.orgName}
              </span>
            </div>

            <div className="max-w-3xl space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
                Recover overdue cash with calm, staged automation.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                UpFlow reads your Xero position, identifies what needs follow-up,
                and routes each account through the right path: email first, AI
                voice next, and human escalation only where it truly matters.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="h-11 px-6 text-sm" asChild>
                <Link to="/app">
                  Open control room
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-11 px-6 text-sm" asChild>
                <Link to="/app/actions">Review overdue actions</Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MiniCallout
                icon={<Mail className="size-4" />}
                label="Email first"
                value={`${emailReady} queued`}
              />
              <MiniCallout
                icon={<AudioWaveform className="size-4" />}
                label="AI voice next"
                value={`${voiceReady} ready`}
              />
              <MiniCallout
                icon={<ShieldCheck className="size-4" />}
                label="Escalate last"
                value="Human only when needed"
              />
            </div>
          </div>
        </section>

        <section className="panel p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                30-day liquidity
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                Projected balance {gbp(projectedBalance)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                A cleaner read on where cash lands next, with inflows, outflows,
                and follow-up pressure already reflected.
              </p>
            </div>

            <div className="rounded-2xl border border-sky-100 bg-white/80 px-3 py-2 text-right shadow-sm">
              <div className="text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
                Current cash
              </div>
              <div className="numeric mt-1 text-2xl font-semibold text-foreground">
                {gbp(data.snapshot.currentCash)}
              </div>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="mt-6 rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(241,248,255,0.92))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <ChartContainer config={chartConfig} className="aspect-[3/1] h-[210px] w-full">
                <AreaChart data={chartData} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-balance)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--color-balance)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `D${v}`}
                    interval="preserveStartEnd"
                  />
                  <YAxis hide domain={["auto", "auto"]} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => gbp(Number(value))}
                        labelFormatter={(label) => `Day ${label}`}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="var(--color-balance)"
                    fill="url(#balanceFill)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-3">
            <SignalPill label="DSO" value={`${data.liquidity.dso.toFixed(2)}d`} />
            <SignalPill label="DPO" value={`${data.liquidity.dpo.toFixed(2)}d`} />
            <SignalPill label="CCC" value={`${data.liquidity.ccc.toFixed(2)}d`} tone="warning" />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="panel p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Cash picture
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                Four numbers that matter now
              </h2>
            </div>
            {followUpCount > 0 && (
              <span className="rounded-full border border-sky-100 bg-white/78 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                {followUpCount} ready for action
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PreviewKpi
              label="Current cash"
              value={gbp(data.snapshot.currentCash)}
              icon={<Landmark className="size-4" />}
            />
            <PreviewKpi
              label="Overdue receivables"
              value={gbp(data.snapshot.overdueReceivables)}
              icon={<Banknote className="size-4" />}
              tone="warning"
              subtitle={
                data.snapshot.overdueWithLatePaymentCharges
                  ? `With UK late-payment charges: ${gbp(data.snapshot.overdueWithLatePaymentCharges)}`
                  : undefined
              }
            />
            <PreviewKpi
              label="Recoverable cash"
              value={gbp(data.snapshot.recoverableCash)}
              icon={<ShieldCheck className="size-4" />}
              tone="positive"
            />
            <PreviewKpi
              label="Revenue opportunities"
              value={gbp(data.snapshot.revenueOpportunityTotal)}
              icon={<TrendingUp className="size-4" />}
              tone="positive"
            />
          </div>
        </section>

        <section className="panel p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Next accounts
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                Collection priority, already staged
              </h2>
            </div>
            <div className="text-right">
              <div className="text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
                Est. recovery
              </div>
              <div className="numeric mt-1 text-2xl font-semibold text-positive">
                {gbp(estimatedRecovery)}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {topInvoices.length > 0 ? (
              topInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="rounded-[26px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,247,255,0.9))] p-4 shadow-[0_18px_38px_-30px_rgba(11,31,51,0.28)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="max-w-[70%]">
                      <div className="text-lg font-semibold text-foreground">{invoice.customer}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {invoice.daysOverdue}d overdue | {invoice.reason}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="numeric text-xl font-semibold text-warning">
                        {gbp(invoice.amount)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Recovery {Math.round(invoice.recoveryProbability * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[26px] border border-dashed border-sky-200 bg-white/72 p-5 text-sm text-muted-foreground">
                No overdue invoices are waiting right now.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="flex flex-col items-center gap-4 pb-2 text-center">
        {followUpCount > 0 && (
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            <span className="font-medium text-foreground">{followUpCount}</span>{" "}
            {followUpCount === 1 ? "account is" : "accounts are"} ready for follow-up,
            with deterministic rules deciding whether the next step is email,
            AI voice, or human escalation.
          </p>
        )}
        <Button size="lg" asChild>
          <Link to="/app">
            Enter control room
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        {followUpCount > 0 && (
          <Link to="/app/actions" className="text-sm text-primary hover:underline">
            Jump straight to follow-up actions
          </Link>
        )}
      </div>
    </div>
  );
}

function MiniCallout({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/80 bg-white/68 p-4 shadow-[0_16px_32px_-28px_rgba(11,31,51,0.3)]">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-700">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-3 text-sm text-muted-foreground">{value}</div>
    </div>
  );
}

function SignalPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div className="rounded-[22px] border border-white/80 bg-white/72 px-4 py-3 shadow-sm">
      <div className="text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "numeric mt-2 text-2xl font-semibold text-foreground",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function PreviewKpi({
  label,
  value,
  icon,
  tone,
  subtitle,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "positive" | "warning";
  subtitle?: string;
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning"
      : tone === "positive"
        ? "text-positive"
        : "text-foreground";

  return (
    <div className="rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,247,255,0.9))] p-5 text-left shadow-[0_18px_38px_-30px_rgba(11,31,51,0.28)]">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn("numeric mt-3 text-3xl font-semibold", toneClass)}>{value}</div>
      {subtitle ? (
        <div className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</div>
      ) : null}
    </div>
  );
}

