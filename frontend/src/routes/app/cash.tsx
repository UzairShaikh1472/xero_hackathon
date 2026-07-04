import { createFileRoute } from "@tanstack/react-router";

import { CashRevenueLens } from "@/components/control-room/cash-revenue-lens";
import { TourAnchor, TOUR_STEPS } from "@/components/control-room/demo-tour";
import { useControlRoom } from "@/components/control-room/control-room-context";

export const Route = createFileRoute("/app/cash")({
  component: CashPage,
  validateSearch: (search: Record<string, unknown>) => ({
    customer: typeof search.customer === "string" ? search.customer : undefined,
  }),
});

function CashPage() {
  const { data, setOpenDraft, tourStep } = useControlRoom();
  const { customer } = Route.useSearch();
  const activeAnchor = tourStep !== null ? TOUR_STEPS[tourStep].anchor : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cash & Revenue Lens</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Liquidity signals and revenue opportunities from Xero, by customer.
        </p>
        {customer && (
          <p className="mt-2 text-sm text-primary">
            Highlighting: {customer}
          </p>
        )}
      </div>

      <TourAnchor id="cash" active={activeAnchor === "cash"}>
        <CashRevenueLens data={data} onOpen={setOpenDraft} highlightCustomer={customer} />
      </TourAnchor>
    </div>
  );
}
