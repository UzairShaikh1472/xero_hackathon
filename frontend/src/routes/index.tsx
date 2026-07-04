import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";

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
        <p className="text-sm text-muted-foreground">Loading your cash snapshot…</p>
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
      <header className="border-b hairline px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[960px] items-center justify-between">
          <span className="text-lg font-semibold">UpFlow</span>
          <span className="text-sm text-muted-foreground">
            {data.snapshot.mode === "live" ? "Live from Xero" : "Demo dataset"}
          </span>
        </div>
      </header>
      <WelcomeHero data={data} />
    </div>
  );
}
