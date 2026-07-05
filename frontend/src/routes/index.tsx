import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { AppIntroOverlay } from "@/components/control-room/app-intro-overlay";
import { WelcomeHero } from "@/components/control-room/welcome-hero";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { controlRoomQuery } from "@/lib/kinetic/queries";

export const Route = createFileRoute("/")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(controlRoomQuery),
  component: WelcomePage,
});

function WelcomePage() {
  const { data, isPending, isError, error, refetch, isFetching } =
    useQuery(controlRoomQuery);

  if (isPending) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <RefreshCw className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your cash snapshot...</p>
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppIntroOverlay />
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: "var(--gradient-glow)" }}
      />

      <header className="px-4 py-4 sm:px-6 sm:py-5">
        <div className="panel mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_18px_40px_-22px_rgba(11,31,51,0.9)]">
              <span className="text-lg font-semibold">U</span>
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold text-foreground">UpFlow</div>
              <div className="truncate text-sm text-muted-foreground">
                Cash recovery, escalation, and customer follow-up from Xero
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/80 bg-white/72 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              {data.snapshot.orgName}
            </span>
            <span className="rounded-full border border-emerald-200/80 bg-emerald-50/92 px-3 py-1 text-xs font-medium text-emerald-700 shadow-sm">
              {data.snapshot.mode === "live" ? "Live from Xero" : "Demo dataset"}
            </span>
          </div>
        </div>
      </header>

      <WelcomeHero data={data} />
    </div>
  );
}
