import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppErrorState({
  message,
  onRetry,
  isFetching,
}: {
  message: string;
  onRetry: () => void;
  isFetching: boolean;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4">
      <AlertTriangle className="size-8 text-critical" />
      <p className="text-center text-sm text-muted-foreground">{message}</p>
      <Button size="sm" onClick={onRetry} disabled={isFetching}>
        <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
        Retry
      </Button>
    </div>
  );
}
