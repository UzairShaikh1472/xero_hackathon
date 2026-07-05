import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { ActionsFollowUp } from "@/components/control-room/actions-follow-up";
import { TourAnchor, TOUR_STEPS } from "@/components/control-room/demo-tour";
import { useControlRoom } from "@/components/control-room/control-room-context";
import { buildEscalationTimeline } from "@/lib/kinetic/action-timeline";
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
    communications,
    executions,
    isDraftsFetching,
    isDraftsError,
    draftsError,
    tourStep,
    handleSendEmail,
    handleSendVoiceInvite,
    handleStartCall,
    refetch,
  } = useControlRoom();
  const { data: followUps } = useQuery(followUpsQuery);
  const activeAnchor = tourStep !== null ? TOUR_STEPS[tourStep].anchor : null;

  const escalationSteps = useMemo(
    () =>
      buildEscalationTimeline({
        followUps,
        communications,
        executions,
        audit: data.audit,
        drafts: data.drafts,
      }),
    [followUps, communications, executions, data.audit, data.drafts],
  );

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
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl tracking-tight">Actions</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Choose how to follow up: email, AI voice, or human escalation.
        </p>
        {isDraftsFetching && data.drafts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Loading follow-up drafts from Xero...
          </p>
        )}
        {!isDraftsFetching && data.drafts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No overdue receivables drafts right now. Check Cash Lens for at-risk invoices or refresh after syncing Xero.
          </p>
        )}
      </div>

      <ActionsFollowUp
        drafts={data.drafts}
        emailConfigured={health?.emailConfigured ?? false}
        browserVoiceConfigured={health?.browserVoiceConfigured ?? false}
        onSendEmail={handleSendEmail}
        onSendVoiceInvite={handleSendVoiceInvite}
        onStartCall={handleStartCall}
      />
    </div>
  );
}
