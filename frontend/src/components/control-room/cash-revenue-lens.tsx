import { useMemo } from "react";
import { Activity, AlertTriangle, ChevronRight, RefreshCw, Repeat } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { gbp } from "@/lib/kinetic/format";
import type {
  ControlRoomData,
  InvoiceRisk,
  LapsedCustomer,
  NegotiationDraft,
  RepeatBuyer,
} from "@/lib/kinetic/types";

import { LensHeader } from "./shared";

/** Independent per-category lists. Overdue can overlap with the other two
 * (a customer can owe money AND be a loyalty/reactivation candidate) — that's
 * a different fact about them, shown on its own row.
 *
 * Loyalty potential and Reactivation are kept mutually exclusive by recency:
 * still buying (loyalty) vs gone quiet (reactivation) is a single either/or
 * fact about a customer, so nobody should land in both.
 *
 * Lapsed customers who are already overdue are excluded from Reactivation —
 * that recovery estimate is a discounted echo of the same debt, not separate
 * money (unlike loyalty upsell, which is genuinely independent). */
function categorizeCustomers(data: ControlRoomData) {
  const atRiskNames = new Set(data.atRiskInvoices.map((inv) => inv.customer));
  const lapsedNames = new Set(data.lapsedCustomers.map((c) => c.name));

  const overdue = [...data.atRiskInvoices].sort(
    (a, b) => b.expectedRecovery - a.expectedRecovery,
  );

  const loyalty = data.repeatBuyers
    .filter((c) => !lapsedNames.has(c.name))
    .sort((a, b) => b.upsellPotential - a.upsellPotential);

  const reactivation = data.lapsedCustomers
    .filter((c) => !atRiskNames.has(c.name))
    .sort((a, b) => b.daysSilent - a.daysSilent);

  return { overdue, loyalty, reactivation };
}

export function CashRevenueLens({
  data,
  onOpen,
}: {
  data: ControlRoomData;
  onOpen: (d: NegotiationDraft) => void;
}) {
  const draftByName = useMemo(() => {
    const m = new Map<string, NegotiationDraft>();
    data.drafts.forEach((d) => m.set(d.targetName, d));
    return m;
  }, [data.drafts]);

  const { overdue, loyalty, reactivation } = useMemo(() => categorizeCustomers(data), [data]);

  return (
    <section className="panel p-6">
      <LensHeader
        icon={<Activity className="size-4" />}
        title="Cash & Revenue Lens"
        subtitle="Liquidity signals and revenue opportunities from Xero, by customer"
      />

      <Section icon={<AlertTriangle className="size-3.5" />} title="Overdue" hint="ranked by recoverable cash — already factors in collection confidence" count={overdue.length}>
        {overdue.map((inv) => (
          <OverdueRow key={inv.id} invoice={inv} draft={draftByName.get(inv.customer)} onOpen={onOpen} />
        ))}
      </Section>

      <Section icon={<Repeat className="size-3.5" />} title="Loyalty potential" hint="still buying — ranked by upsell value" count={loyalty.length}>
        {loyalty.map((c) => (
          <RepeatRow key={c.id} customer={c} draft={draftByName.get(c.name)} onOpen={onOpen} />
        ))}
      </Section>

      <Section icon={<RefreshCw className="size-3.5" />} title="Reactivation" hint="gone quiet — ranked by days silent" count={reactivation.length}>
        {reactivation.map((c) => (
          <LapsedRow key={c.id} customer={c} draft={draftByName.get(c.name)} onOpen={onOpen} />
        ))}
      </Section>
    </section>
  );
}

function Section({
  icon,
  title,
  hint,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {title}
          <span className="text-muted-foreground font-normal">({count})</span>
        </div>
        <div className="text-sm text-muted-foreground">{hint}</div>
      </div>
      <div className="divide-y divide-hairline">{children}</div>
    </div>
  );
}

function RowShell({
  name,
  tag,
  subtitle,
  amount,
  draft,
  onOpen,
}: {
  name: string;
  tag?: string;
  subtitle: string;
  amount?: React.ReactNode;
  draft?: NegotiationDraft;
  onOpen: (d: NegotiationDraft) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{name}</span>
          {tag && <span className="text-sm text-muted-foreground numeric shrink-0">{tag}</span>}
        </div>
        <div className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{subtitle}</div>
      </div>
      <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:contents">
        <div className="numeric text-right shrink-0 space-y-0.5">{amount}</div>
        <Button
          size="sm"
          variant={draft ? "default" : "outline"}
          disabled={!draft}
          onClick={() => draft && onOpen(draft)}
          className={cn(!draft && "border-hairline")}
        >
          {draft ? "Review draft" : "No draft"}
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function OverdueRow({
  invoice,
  draft,
  onOpen,
}: {
  invoice: InvoiceRisk;
  draft?: NegotiationDraft;
  onOpen: (d: NegotiationDraft) => void;
}) {
  return (
    <RowShell
      name={invoice.customer}
      tag={`#${invoice.id.slice(-4)}`}
      subtitle={invoice.reason}
      draft={draft}
      onOpen={onOpen}
      amount={
        <>
          <div className="font-medium text-warning">
            {gbp(invoice.expectedRecovery)} recoverable in ~{invoice.expectedDaysToCollect}d
          </div>
          <div className="text-sm text-muted-foreground">{gbp(invoice.amount)} owed</div>
        </>
      }
    />
  );
}

function RepeatRow({
  customer,
  draft,
  onOpen,
}: {
  customer: RepeatBuyer;
  draft?: NegotiationDraft;
  onOpen: (d: NegotiationDraft) => void;
}) {
  return (
    <RowShell
      name={customer.name}
      subtitle={`${customer.transactions12m} orders/12m · avg ${gbp(customer.avgInvoice)}`}
      draft={draft}
      onOpen={onOpen}
      amount={<div className="text-sm text-positive">+{gbp(customer.upsellPotential)} upsell</div>}
    />
  );
}

function LapsedRow({
  customer,
  draft,
  onOpen,
}: {
  customer: LapsedCustomer;
  draft?: NegotiationDraft;
  onOpen: (d: NegotiationDraft) => void;
}) {
  return (
    <RowShell
      name={customer.name}
      subtitle={`Lapsed ${customer.daysSilent}d silent`}
      draft={draft}
      onOpen={onOpen}
    />
  );
}
