import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";

import { BrowserVoiceAgent } from "@/components/voice/browser-voice-agent";
import { Button } from "@/components/ui/button";
import { fetchVoiceSession } from "@/lib/kinetic/api";

export const Route = createFileRoute("/call/$token")({
  component: CallPage,
});

function CallPage() {
  const { token } = Route.useParams();

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["voice-session", token],
    queryFn: () => fetchVoiceSession(token),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b hairline px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <span className="text-lg font-semibold">UpFlow Voice Agent</span>
          <span className="text-sm text-muted-foreground">Browser call</span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        {isPending ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading call session…</p>
          </div>
        ) : isError || !data ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <AlertTriangle className="size-8 text-critical" />
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "This call link is invalid or expired."}
            </p>
            <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
              Retry
            </Button>
          </div>
        ) : (
          <BrowserVoiceAgent session={data} />
        )}
      </main>
    </div>
  );
}
