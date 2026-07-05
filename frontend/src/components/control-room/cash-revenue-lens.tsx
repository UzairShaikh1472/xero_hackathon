import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
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

type CashLensCategory = "overdue" | "loyalty" | "reactivation";

const DEFAULT_VISIBLE: CashLensCategory[] = ["overdue", "loyalty", "reactivation"];

const CATEGORY_FILTERS: Array<{
  key: CashLensCategory;
  label: string;
  icon: React.ReactNode;
}> = [
  { key: "overdue", label: "Overdue", icon: <AlertTriangle className="size-3.5" /> },
  { key: "loyalty", label: "Loyalty potential", icon: <Repeat className="size-3.5" /> },
  { key: "reactivation", label: "Reactivation", icon: <RefreshCw className="size-3.5" /> },
];

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

function CategoryFilter({
  value,
  onChange,
  counts,
}: {
  value: CashLensCategory[];
  onChange: (value: CashLensCategory[]) => void;
  counts: Record<CashLensCategory, number>;
}) {
  const toggle = (key: CashLensCategory) => {
    onChange(
      value.includes(key) ? value.filter((item) => item !== key) : [...value, key],
    );
  };

  return (
    <div className="flex flex-wrap justify-start gap-1">
      {CATEGORY_FILTERS.map(({ key, label, icon }) => {
        const selected = value.includes(key);
        return (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={selected ? "default" : "outline"}
            aria-pressed={selected}
            aria-label={label}
            className={cn("gap-1.5", !selected && "border-hairline")}
            onClick={() => toggle(key)}
          >
            {icon}
            {label}
            <span className={cn(!selected && "text-muted-foreground")}>
              ({counts[key]})
            </span>
          </Button>
        );
      })}
    </div>
  );
}

export function CashRevenueLens({
  data,
  onOpen,
  highlightCustomer,
  focus,
}: {
  data: ControlRoomData;
  onOpen: (d: NegotiationDraft) => void;
  highlightCustomer?: string;
  focus?: string;
}) {
  const [visibleCategories, setVisibleCategories] = useState<CashLensCategory[]>(DEFAULT_VISIBLE);

  const draftByName = useMemo(() => {
    const m = new Map<string, NegotiationDraft>();
    data.drafts.forEach((d) => m.set(d.targetName, d));
    return m;
  }, [data.drafts]);

  const { overdue, loyalty, reactivation } = useMemo(() => categorizeCustomers(data), [data]);
  const showNothing = visibleCategories.length === 0;

  return (
    <section className="panel p-6">
      <LensHeader
        icon={<Activity className="size-4" />}
        title="Cash & Revenue Lens"
        subtitle="Liquidity signals and revenue opportunities from Xero, by customer"
        right={
          <CategoryFilter
            value={visibleCategories}
            onChange={setVisibleCategories}
            counts={{
              overdue: overdue.length,
              loyalty: loyalty.length,
              reactivation: reactivation.length,
            }}
          />
        }
      />

      {showNothing ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Select at least one category to view customers.
        </p>
      ) : (
        <>
          {visibleCategories.includes("overdue") && (
            <Section icon={<AlertTriangle className="size-3.5" />} title="Overdue" hint="ranked by recoverable cash: already factors in collection confidence" count={overdue.length}>
              {overdue.map((inv) => (
                <OverdueRow key={inv.id} invoice={inv} draft={draftByName.get(inv.customer)} onOpen={onOpen} highlighted={inv.customer === highlightCustomer} />
              ))}
            </Section>
          )}

          {visibleCategories.includes("loyalty") && (
            <Section icon={<Repeat className="size-3.5" />} title="Loyalty potential" hint="still buying: ranked by upsell value" count={loyalty.length}>
              {loyalty.map((c) => (
                <RepeatRow key={c.id} customer={c} draft={draftByName.get(c.name)} onOpen={onOpen} highlighted={c.name === highlightCustomer} />
              ))}
            </Section>
          )}

          {visibleCategories.includes("reactivation") && (
            <Section icon={<RefreshCw className="size-3.5" />} title="Reactivation" hint="gone quiet: ranked by days silent" count={reactivation.length}>
              {reactivation.map((c) => (
                <LapsedRow key={c.id} customer={c} draft={draftByName.get(c.name)} onOpen={onOpen} highlighted={c.name === highlightCustomer} />
              ))}
            </Section>
          )}
        </>
      )}
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
  highlighted,
}: {
  name: string;
  tag?: string;
  subtitle: string;
  amount?: React.ReactNode;
  draft?: NegotiationDraft;
  onOpen: (d: NegotiationDraft) => void;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center",
        highlighted && "rounded-lg bg-primary/5 ring-1 ring-primary/20 -mx-2 px-2",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{name}</span>
          {tag && <span className="text-sm text-muted-foreground numeric shrink-0">{tag}</span>}
        </div>
        <div className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{subtitle}</div>
      </div>
      <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:contents">
        {amount != null && (
          <div className="numeric text-right shrink-0 space-y-0.5">{amount}</div>
        )}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
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
          {draft && (
            <Button size="sm" variant="outline" className="border-hairline" asChild>
              <Link to="/app/actions" search={{ customer: name }}>
                Action
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function OverdueRow({
  invoice,
  draft,
  onOpen,
  highlighted,
}: {
  invoice: InvoiceRisk;
  draft?: NegotiationDraft;
  onOpen: (d: NegotiationDraft) => void;
  highlighted?: boolean;
}) {
  return (
    <RowShell
      name={invoice.customer}
      tag={`#${invoice.id.slice(-4)}`}
      subtitle={invoice.reason}
      draft={draft}
      onOpen={onOpen}
      highlighted={highlighted}
      amount={
        <div className="text-sm text-positive">+{gbp(invoice.expectedRecovery)} recoverable</div>
      }
    />
  );
}

function RepeatRow({
  customer,
  draft,
  onOpen,
  highlighted,
}: {
  customer: RepeatBuyer;
  draft?: NegotiationDraft;
  onOpen: (d: NegotiationDraft) => void;
  highlighted?: boolean;
}) {
  return (
    <RowShell
      name={customer.name}
      subtitle={`${customer.transactions12m} orders/12m · avg ${gbp(customer.avgInvoice)}`}
      draft={draft}
      onOpen={onOpen}
      highlighted={highlighted}
      amount={<div className="text-sm text-positive">+{gbp(customer.upsellPotential)} upsell</div>}
    />
  );
}

function LapsedRow({
  customer,
  draft,
  onOpen,
  highlighted,
}: {
  customer: LapsedCustomer;
  draft?: NegotiationDraft;
  onOpen: (d: NegotiationDraft) => void;
  highlighted?: boolean;
}) {
  return (
    <RowShell
      name={customer.name}
      subtitle={`Lapsed ${customer.daysSilent}d silent`}
      draft={draft}
      onOpen={onOpen}
      highlighted={highlighted}
      amount={
        <div className="text-sm text-positive">
          +{gbp(customer.recoveryPotential)} reactivation
        </div>
      }
    />
  );
}
