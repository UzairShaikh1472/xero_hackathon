import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { AgentsBand } from "@/components/control-room/agents-band";
import { ApprovalDrawer } from "@/components/control-room/approval-drawer";
import { CashRevenueLens } from "@/components/control-room/cash-revenue-lens";
import {
  DemoTour,
  TOUR_STEPS,
  TourAnchor,
} from "@/components/control-room/demo-tour";
import { Header } from "@/components/control-room/header";
import { KpiStrip } from "@/components/control-room/kpi-strip";
import { fetchControlRoom, fetchHealth, fetchXeroAuthUrl, simulateExecute } from "@/lib/kinetic/api";
import type { ExecutionResult, NegotiationDraft } from "@/lib/kinetic/types";

const controlRoomQuery = queryOptions({
  queryKey: ["kinetic", "control-room"],
  queryFn: () => fetchControlRoom(),
  staleTime: 60_000,
  refetchOnWindowFocus: false,
});

const healthQuery = queryOptions({
  queryKey: ["kinetic", "health"],
  queryFn: () => fetchHealth(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/")({
  component: ControlRoom,
});

function ControlRoom() {
  const { data, isPending, isError, error, refetch, isFetching } =
    useQuery(controlRoomQuery);
  const { data: health } = useQuery(healthQuery);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("xero") === "connected") {
      refetch();
      params.delete("xero");
      const next = params.toString();
      window.history.replaceState(
        {},
        "",
        next ? `${window.location.pathname}?${next}` : window.location.pathname,
      );
    }
  }, [refetch]);
  const [openDraft, setOpenDraft] = useState<NegotiationDraft | null>(null);
  const [executions, setExecutions] = useState<ExecutionResult[]>([]);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [connectingXero, setConnectingXero] = useState(false);

  const handleConnectXero = async () => {
    setConnectingXero(true);
    try {
      const status = health ?? (await fetchHealth());
      if (!status.xeroConfigured) {
        toast.error("Xero is not configured on the backend", {
          description:
            "Add XERO_CLIENT_ID and XERO_CLIENT_SECRET to .env (from developer.xero.com), set the redirect URI to http://localhost:3001/api/xero/callback, then restart the backend.",
        });
        return;
      }
      const authUrl = await fetchXeroAuthUrl();
      window.location.href = authUrl;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start Xero connection",
      );
    } finally {
      setConnectingXero(false);
    }
  };

  if (isPending) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <RefreshCw className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Syncing with Xero…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-foreground">
        <AlertTriangle className="size-8 text-critical" />
        <p className="text-center text-sm text-muted-foreground">
          {error instanceof Error
            ? error.message
            : "Could not load dashboard data from the backend."}
        </p>
        <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          Retry
        </Button>
      </div>
    );
  }

  const executedTotal = executions.reduce((s, e) => s + e.cashImpact, 0);
  const projectedShortfall = data.liquidity.projectedShortfall + executedTotal;

  const handleSimulate = async (draft: NegotiationDraft) => {
    const res = await simulateExecute(draft, projectedShortfall);
    setExecutions((prev) => [...prev.filter((e) => e.draftId !== draft.id), res]);
  };

  const activeAnchor = tourStep !== null ? TOUR_STEPS[tourStep].anchor : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        orgName={data.snapshot.orgName}
        mode={data.snapshot.mode}
        lastSyncAt={data.snapshot.lastSyncAt}
        xeroConfigured={health?.xeroConfigured ?? false}
        isFetching={isFetching}
        connectingXero={connectingXero}
        onConnectXero={handleConnectXero}
        onRefresh={() => refetch()}
        onReset={() => {
          setExecutions([]);
          setTourStep(null);
        }}
        onStartTour={() => setTourStep(0)}
      />

      <main className="mx-auto max-w-[1440px] px-4 py-6 space-y-6 sm:px-6">
        <TourAnchor id="kpi" active={activeAnchor === "kpi"}>
          <KpiStrip
            currentCash={data.snapshot.currentCash + executedTotal}
            recoverableCash={data.snapshot.recoverableCash}
            opportunityTotal={data.snapshot.revenueOpportunityTotal}
            executedTotal={executedTotal}
          />
        </TourAnchor>

        <TourAnchor id="cash" active={activeAnchor === "cash"}>
          <CashRevenueLens data={data} onOpen={setOpenDraft} />
        </TourAnchor>

        <TourAnchor id="agents" active={activeAnchor === "agents"}>
          <AgentsBand
            drafts={data.drafts}
            executions={executions}
            onOpen={setOpenDraft}
          />
        </TourAnchor>

        <footer className="pt-6 pb-10 text-center text-xs text-muted-foreground">
          UpFlow · deterministic financial logic + agentic recommendations ·
          {data.snapshot.mode === "live" ? "live Xero data" : "fallback dataset"}
        </footer>
      </main>

      <ApprovalDrawer
        draft={openDraft}
        execution={
          openDraft ? executions.find((e) => e.draftId === openDraft.id) ?? null : null
        }
        onClose={() => setOpenDraft(null)}
        onSimulate={handleSimulate}
      />

      <DemoTour
        step={tourStep}
        onNext={() =>
          setTourStep((s) =>
            s === null ? null : s + 1 >= TOUR_STEPS.length ? null : s + 1,
          )
        }
        onPrev={() => setTourStep((s) => (s === null || s === 0 ? s : s - 1))}
        onClose={() => setTourStep(null)}
      />
    </div>
  );
}
