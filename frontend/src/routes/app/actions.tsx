import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { ActionsFollowUp } from "@/components/control-room/actions-follow-up";
import { ActionsResolved } from "@/components/control-room/actions-resolved";
import { useControlRoom } from "@/components/control-room/control-room-context";
import { controlRoomQuery, followUpsQuery, draftsQuery } from "@/lib/kinetic/queries";

import { AppErrorState } from "@/components/control-room/app-error-state";

export const Route = createFileRoute("/app/actions")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(followUpsQuery);
    const controlRoom = queryClient.getQueryData(controlRoomQuery.queryKey);
    if (controlRoom?.snapshot.mode === "live") {
      await queryClient.ensureQueryData(draftsQuery);
    }
  },
  component: ActionsPage,
});

function ActionsPage() {
  const {
    data,
    health,
    isDraftsFetching,
    isDraftsError,
    draftsError,
    setOpenDraft,
    handleSendEmail,
    handleSendVoiceInvite,
    handleStartCall,
    refetch,
  } = useControlRoom();
  const { data: followUps } = useQuery(followUpsQuery);

  if (isDraftsError && data.drafts.length === 0) {
    return (
      <AppErrorState
        message={
          draftsError?.message ??
          "Could not load follow-up drafts. Make sure the backend is running on port 3001."
        }
        onRetry={() => refetch()}
        isFetching={isDraftsFetching}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Actions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how to follow up: email, AI voice, or human escalation.
        </p>
        {isDraftsFetching && data.drafts.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Loading follow-up drafts from Xero…
          </p>
        )}
        {!isDraftsFetching && data.drafts.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            No overdue receivables drafts right now. Check Cash Lens for at-risk invoices or refresh after syncing Xero.
          </p>
        )}
      </div>

      <ActionsFollowUp
        drafts={data.drafts}
        emailConfigured={health?.emailConfigured ?? false}
        browserVoiceConfigured={health?.browserVoiceConfigured ?? false}
        onOpen={setOpenDraft}
        onSendEmail={handleSendEmail}
        onSendVoiceInvite={handleSendVoiceInvite}
        onStartCall={handleStartCall}
      />

      <ActionsResolved resolved={followUps?.resolved ?? []} />
    </div>
  );
}
