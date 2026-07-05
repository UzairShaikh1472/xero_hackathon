import { Link } from "@tanstack/react-router";
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
    <header className="border-b hairline bg-surface/55 backdrop-blur-xl">
      <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:flex sm:flex-wrap sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary text-primary-foreground transition-transform duration-200 hover:scale-[1.02]"
            style={{ boxShadow: "var(--shadow-neon)" }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/12 via-transparent to-cyan-300/30" />
          </Link>
          <div className="min-w-0">
            <Link to="/" className="font-sans text-lg font-semibold hover:underline">
              UpFlow
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
