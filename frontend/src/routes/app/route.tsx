import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppNav } from "@/components/control-room/app-nav";
import { ApprovalDrawer } from "@/components/control-room/approval-drawer";
import {
  ControlRoomProvider,
  useControlRoom,
} from "@/components/control-room/control-room-context";
import { DemoTour, TOUR_STEPS } from "@/components/control-room/demo-tour";
import { Header } from "@/components/control-room/header";
import { controlRoomQuery, draftsQuery, healthQuery } from "@/lib/kinetic/queries";

export const Route = createFileRoute("/app")({
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(controlRoomQuery),
      queryClient.ensureQueryData(healthQuery),
    ]);
    const controlRoom = queryClient.getQueryData(controlRoomQuery.queryKey);
    if (controlRoom?.snapshot.mode === "live") {
      await queryClient.ensureQueryData(draftsQuery);
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <ControlRoomProvider>
      <AppShell />
    </ControlRoomProvider>
  );
}

function AppShell() {
  const {
    data,
    health,
    isFetching,
    connectingXero,
    executions,
    communications,
    openDraft,
    tourStep,
    setOpenDraft,
    handleSimulate,
    handleSendEmail,
    handleSendVoiceInvite,
    handleStartCall,
    handleConnectXero,
    refetch,
    resetSession,
    startTour,
    setTourStep,
  } = useControlRoom();

  const activeAnchor = tourStep !== null ? TOUR_STEPS[tourStep].anchor : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: "var(--gradient-glow)" }}
      />
      <Header
        orgName={data.snapshot.orgName}
        mode={data.snapshot.mode}
        lastSyncAt={data.snapshot.lastSyncAt}
        xeroConfigured={health?.xeroConfigured ?? false}
        isFetching={isFetching}
        connectingXero={connectingXero}
        onConnectXero={handleConnectXero}
        onRefresh={() => refetch()}
        onReset={resetSession}
        onStartTour={startTour}
      />
      <AppNav />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
        <Outlet />
        <footer className="pb-10 pt-8 text-center text-xs text-muted-foreground">
          UpFlow | deterministic financial logic + agentic recommendations |{" "}
          {data.snapshot.mode === "live" ? "live Xero data" : "fallback dataset"}
        </footer>
      </main>

      {openDraft ? (
        <ApprovalDrawer
          draft={openDraft}
          execution={executions.find((e) => e.draftId === openDraft.id) ?? null}
          communication={
            communications.find((c) => c.draftId === openDraft.id) ?? null
          }
          emailConfigured={health?.emailConfigured ?? false}
          browserVoiceConfigured={health?.browserVoiceConfigured ?? false}
          onClose={() => setOpenDraft(null)}
          onSimulate={handleSimulate}
          onSendEmail={handleSendEmail}
          onSendVoiceInvite={handleSendVoiceInvite}
          onStartCall={handleStartCall}
        />
      ) : null}

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

      {activeAnchor !== null && (
        <span className="sr-only" aria-live="polite">
          Tour step: {TOUR_STEPS[tourStep!].title}
        </span>
      )}
    </div>
  );
}

export { AppLoadingState } from "@/components/control-room/app-loading-state";
export { AppErrorState } from "@/components/control-room/app-error-state";

