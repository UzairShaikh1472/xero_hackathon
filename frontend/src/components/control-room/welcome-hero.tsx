import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Banknote,
  Landmark,
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
    color: "hsl(var(--primary))",
  },
};

export function WelcomeHero({ data }: { data: ControlRoomData }) {
  const followUpCount = countFollowUps(data.drafts);
  const chartData = data.liquidity.daily.map((d) => ({
    day: d.day,
    balance: d.balance,
  }));

  return (
    <div className="mx-auto max-w-[960px] space-y-10 py-10 sm:py-16">
      <div className="space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Connected to {data.snapshot.orgName} via Xero
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Your cash picture, ready to act on
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          UpFlow reads your Xero data, surfaces what matters, and drafts follow-ups,
          so you recover cash faster without living in spreadsheets.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PreviewKpi
          label="Current cash"
          value={gbp(data.snapshot.currentCash)}
          icon={<Landmark className="size-4" />}
        />
        <PreviewKpi
          label="Recoverable"
          value={gbp(data.snapshot.recoverableCash)}
          icon={<Banknote className="size-4" />}
          tone="warning"
        />
        <PreviewKpi
          label="Revenue opportunities"
          value={gbp(data.snapshot.revenueOpportunityTotal)}
          icon={<TrendingUp className="size-4" />}
          tone="positive"
        />
      </div>

      {chartData.length > 0 && (
        <div className="panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">30-day liquidity outlook</div>
              <div className="text-sm text-muted-foreground">
                Projected balance across the next month
              </div>
            </div>
            {data.liquidity.projectedShortfall < 0 && (
              <span className="text-sm text-warning">
                Gap: {gbp(Math.abs(data.liquidity.projectedShortfall))}
              </span>
            )}
          </div>
          <ChartContainer config={chartConfig} className="aspect-[3/1] h-[160px] w-full">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-balance)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-balance)" stopOpacity={0} />
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
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      )}

      <div className="flex flex-col items-center gap-4 text-center">
        {followUpCount > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{followUpCount}</span>{" "}
            {followUpCount === 1 ? "item needs" : "items need"} follow-up: email, AI call, or human escalation
          </p>
        )}
        <Button size="lg" asChild>
          <Link to="/app">
            Enter control room
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        {followUpCount > 0 && (
          <Link
            to="/app/actions"
            className="text-sm text-primary hover:underline"
          >
            Jump straight to follow-up actions
          </Link>
        )}
      </div>
    </div>
  );
}

function PreviewKpi({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "positive" | "warning";
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning"
      : tone === "positive"
        ? "text-positive"
        : "text-foreground";

  return (
    <div className="panel p-5 text-center">
      <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn("numeric mt-2 text-2xl font-semibold", toneClass)}>{value}</div>
    </div>
  );
}
