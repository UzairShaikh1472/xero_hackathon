import { RefreshCw } from "lucide-react";

export function AppLoadingState() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
      <RefreshCw className="size-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Syncing with Xero…</p>
    </div>
  );
}
