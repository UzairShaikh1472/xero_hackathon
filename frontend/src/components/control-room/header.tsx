import { Link } from "@tanstack/react-router";
import { CircleDot, Play, RefreshCw } from "lucide-react";

import { UpFlowBrand } from "@/components/control-room/upflow-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/kinetic/format";
import { cn } from "@/lib/utils";

export function Header({
  orgName,
  mode,
  lastSyncAt,
  xeroConfigured,
  isFetching,
  connectingXero,
  onConnectXero,
  onRefresh,
  onReset,
  onStartTour,
}: {
  orgName: string;
  mode: "live" | "fallback";
  lastSyncAt: string;
  xeroConfigured: boolean;
  isFetching: boolean;
  connectingXero: boolean;
  onConnectXero: () => void;
  onRefresh: () => void;
  onReset: () => void;
  onStartTour: () => void;
}) {
  void onReset;

  return (
    <header className="border-b hairline bg-surface/55 backdrop-blur-xl">
      <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:flex sm:flex-wrap sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <Link to="/" className="inline-flex items-center hover:opacity-90">
              <UpFlowBrand size={34} textClassName="text-lg" />
            </Link>
            <div className="truncate text-sm text-muted-foreground">
              Connected to <span className="text-foreground">{orgName}</span> via Xero · last sync{" "}
              <span suppressHydrationWarning>{timeAgo(lastSyncAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 border-hairline shadow-sm",
              mode === "live"
                ? "border-positive/30 bg-positive/10 text-positive"
                : "border-warning/30 bg-warning/10 text-warning",
            )}
            style={
              mode === "live"
                ? { boxShadow: "0 0 0 1px rgba(0,184,148,0.08), 0 8px 22px -16px rgba(0,184,148,0.35)" }
                : undefined
            }
          >
            <CircleDot className="size-3" />
            {mode === "live" ? "Live from Xero" : "Demo dataset"}
          </Badge>

          {mode === "fallback" && xeroConfigured && (
            <Button size="sm" onClick={onConnectXero} disabled={connectingXero}>
              <RefreshCw className={cn("size-3.5", connectingXero && "animate-spin")} />
              Connect Xero
            </Button>
          )}

          {mode === "fallback" && !xeroConfigured && (
            <span className="text-xs text-muted-foreground">
              Add Xero credentials to .env
            </span>
          )}

          <Button
            size="sm"
            onClick={onStartTour}
            className="shadow-sm transition-transform duration-200 hover:-translate-y-px"
            style={{ boxShadow: "var(--shadow-neon)" }}
          >
            <Play className="size-3.5" />
            Start demo
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            className="text-muted-foreground"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
            <span className="sr-only sm:not-sr-only">Refresh</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
