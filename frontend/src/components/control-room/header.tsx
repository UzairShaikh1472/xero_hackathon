import { CircleDot, Play, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/kinetic/format";

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
  return (
    <header className="border-b hairline bg-surface/60 backdrop-blur">
      <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:flex sm:flex-wrap sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M7 19H14M10.5 19V11.5C10.5 8.5 12 7 14.5 7"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M6.5 13H18M18 13L14.75 9.75M18 13L14.75 16.25"
                stroke="var(--accent)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <span className="text-lg font-semibold">UpFlow</span>
            <div className="truncate text-sm text-muted-foreground">
              Connected to <span className="text-foreground">{orgName}</span> via Xero ·
              last sync {timeAgo(lastSyncAt)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 border-hairline",
              mode === "live"
                ? "border-positive/30 bg-positive/10 text-positive"
                : "text-warning",
            )}
          >
            <CircleDot className="size-3" />
            {mode === "live" ? "Live from Xero" : "Demo Dataset"}
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
          <Button size="sm" onClick={onStartTour}>
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
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-muted-foreground"
          >
            <RefreshCw className="size-3.5" />
            <span className="sr-only sm:not-sr-only">Reset</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
