import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { controlRoomQuery, draftsQuery, healthQuery } from "@/lib/kinetic/queries";
import { AppLoadingState } from "@/components/control-room/app-loading-state";
import {
  createVoiceSession,
  fetchHealth,
  fetchXeroAuthUrl,
  sendDraftEmail,
  sendVoiceInvite,
  simulateExecute,
} from "@/lib/kinetic/api";
import type {
  CommunicationResult,
  ControlRoomData,
  ExecutionResult,
  NegotiationDraft,
} from "@/lib/kinetic/types";

type ControlRoomContextValue = {
  data: ControlRoomData;
  health: Awaited<ReturnType<typeof fetchHealth>> | undefined;
  isFetching: boolean;
  isDraftsFetching: boolean;
  isDraftsError: boolean;
  draftsError: Error | null;
  connectingXero: boolean;
  executions: ExecutionResult[];
  communications: CommunicationResult[];
  openDraft: NegotiationDraft | null;
  tourStep: number | null;
  executedTotal: number;
  projectedShortfall: number;
  setOpenDraft: (draft: NegotiationDraft | null) => void;
  handleSimulate: (draft: NegotiationDraft) => Promise<void>;
  handleSendEmail: (
    draft: NegotiationDraft,
    edits: { subject: string; body: string },
  ) => Promise<void>;
  handleSendVoiceInvite: (
    draft: NegotiationDraft,
    edits?: { subject: string; body: string },
  ) => Promise<void>;
  handleStartCall: (draft: NegotiationDraft) => Promise<void>;
  handleConnectXero: () => Promise<void>;
  refetch: () => void;
  resetSession: () => void;
  startTour: () => void;
  setTourStep: React.Dispatch<React.SetStateAction<number | null>>;
};

const ControlRoomContext = createContext<ControlRoomContextValue | null>(null);

export function ControlRoomProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isPending, isFetching, refetch } = useQuery(controlRoomQuery);
  const { data: health } = useQuery(healthQuery);
  const liveMode = data?.snapshot.mode === "live";
  const {
    data: liveDrafts = [],
    isPending: isDraftsPending,
    isFetching: isDraftsFetching,
    isError: isDraftsError,
    error: draftsError,
  } = useQuery({
    ...draftsQuery,
    enabled: liveMode,
  });
  const [openDraft, setOpenDraft] = useState<NegotiationDraft | null>(null);
  const [executions, setExecutions] = useState<ExecutionResult[]>([]);
  const [communications, setCommunications] = useState<CommunicationResult[]>([]);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [connectingXero, setConnectingXero] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("xero") === "connected") {
      refetch();
      params.delete("xero");
      const next = params.toString();
      window.history.replaceState(
        {},
        "",
        next ? `${window.location.pathname}?${next}` : window.location.pathname,
      );
    }
  }, [refetch]);

  if (isPending || !data) {
    return <AppLoadingState />;
  }

  const mergedData: ControlRoomData = liveMode
    ? { ...data, drafts: liveDrafts }
    : data;

  const executedTotal = executions.reduce((s, e) => s + e.cashImpact, 0);
  const projectedShortfall = mergedData.liquidity.projectedShortfall + executedTotal;

  const recordCommunication = (result: CommunicationResult) => {
    setCommunications((prev) => [
      ...prev.filter((item) => item.draftId !== result.draftId || item.channel !== result.channel),
      { ...result, sentAt: new Date().toISOString() },
    ]);
    void queryClient.invalidateQueries({ queryKey: ["kinetic", "follow-ups"] });
  };

  const handleSimulate = async (draft: NegotiationDraft) => {
    const res = await simulateExecute(draft, projectedShortfall);
    setExecutions((prev) => [...prev.filter((e) => e.draftId !== draft.id), res]);
  };

  const handleSendEmail = async (
    draft: NegotiationDraft,
    edits: { subject: string; body: string },
  ) => {
    if (!health?.emailConfigured) {
      toast.error("Email is not configured", {
        description: "Set SMTP_* vars and COMMUNICATIONS_TEST_EMAIL in backend .env.",
      });
      return;
    }

    try {
      const result = await sendDraftEmail(draft.id, edits, draft.targetId);
      recordCommunication(result);
      toast.success("Email sent", { description: result.message });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email");
      throw err;
    }
  };

  const handleSendVoiceInvite = async (
    draft: NegotiationDraft,
    edits?: { subject: string; body: string },
  ) => {
    if (!health?.emailConfigured) {
      toast.error("Email is not configured", {
        description: "Set SMTP_* vars and COMMUNICATIONS_TEST_EMAIL in backend .env.",
      });
      return;
    }
    if (!health?.browserVoiceConfigured) {
      toast.error("Voice agent is not configured", {
        description: "Set GEMINI_API_KEY or VAPI keys in backend .env.",
      });
      return;
    }

    try {
      const result = await sendVoiceInvite(draft.id, edits, draft.targetId);
      recordCommunication(result);
      toast.success("Voice invite sent", {
        description: result.callUrl
          ? `${result.message} Call link copied to clipboard.`
          : result.message,
      });
      if (result.callUrl) {
        await navigator.clipboard.writeText(result.callUrl).catch(() => undefined);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send voice invite");
      throw err;
    }
  };

  const handleStartCall = async (draft: NegotiationDraft) => {
    if (!health?.browserVoiceConfigured) {
      toast.error("Voice agent is not configured", {
        description: "Set GEMINI_API_KEY or VAPI keys in backend .env.",
      });
      return;
    }

    try {
      const session = await createVoiceSession(draft.id, draft.targetId);
      recordCommunication({
        draftId: draft.id,
        channel: "call",
        status: "sent",
        recipientName: draft.targetName,
        message: "Browser voice call started",
        callUrl: session.callUrl,
        callToken: session.callToken,
      });
      window.open(session.callUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start call");
      throw err;
    }
  };

  const handleConnectXero = async () => {
    setConnectingXero(true);
    try {
      const status = health ?? (await fetchHealth());
      if (!status.xeroConfigured) {
        toast.error("Xero is not configured on the backend", {
          description:
            "Add XERO_CLIENT_ID and XERO_CLIENT_SECRET to .env, set the redirect URI to http://localhost:3001/api/xero/callback, then restart the backend.",
        });
        return;
      }
      const authUrl = await fetchXeroAuthUrl();
      window.location.href = authUrl;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start Xero connection",
      );
    } finally {
      setConnectingXero(false);
    }
  };

  const resetSession = () => {
    setExecutions([]);
    setCommunications([]);
    setTourStep(null);
  };

  return (
    <ControlRoomContext.Provider
      value={{
        data: mergedData,
        health,
        isFetching,
        isDraftsFetching: isDraftsPending || isDraftsFetching,
        isDraftsError,
        draftsError: draftsError instanceof Error ? draftsError : null,
        connectingXero,
        executions,
        communications,
        openDraft,
        tourStep,
        executedTotal,
        projectedShortfall,
        setOpenDraft,
        handleSimulate,
        handleSendEmail,
        handleSendVoiceInvite,
        handleStartCall,
        handleConnectXero,
        refetch: () => {
          void refetch();
          void queryClient.invalidateQueries({ queryKey: ["kinetic", "follow-ups"] });
          void queryClient.invalidateQueries({ queryKey: ["kinetic", "drafts"] });
        },
        resetSession,
        startTour: () => setTourStep(0),
        setTourStep,
      }}
    >
      {children}
    </ControlRoomContext.Provider>
  );
}

export function useControlRoom() {
  const ctx = useContext(ControlRoomContext);
  if (!ctx) {
    throw new Error("useControlRoom must be used within ControlRoomProvider");
  }
  return ctx;
}
