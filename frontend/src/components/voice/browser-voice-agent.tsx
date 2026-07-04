import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, PhoneOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { completeVoiceCall, sendVoiceChat, type VoiceSessionData } from "@/lib/kinetic/api";
import { gbp } from "@/lib/kinetic/format";

type Turn = { role: "user" | "assistant"; content: string };

export function BrowserVoiceAgent({ session }: { session: VoiceSessionData }) {
  const [active, setActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [callSummary, setCallSummary] = useState<string | null>(null);
  const [sendingReport, setSendingReport] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const historyRef = useRef<Turn[]>([]);

  const speak = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) {
        resolve();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const respond = useCallback(
    async (message: string) => {
      setBusy(true);
      setError(null);
      const userTurn: Turn = { role: "user", content: message };
      const nextHistory = [...historyRef.current, userTurn];
      historyRef.current = nextHistory;
      setTurns(nextHistory);

      try {
        const reply = await sendVoiceChat(session.token, message, historyRef.current);
        const assistantTurn: Turn = { role: "assistant", content: reply };
        historyRef.current = [...historyRef.current, assistantTurn];
        setTurns([...historyRef.current]);
        await speak(reply);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Voice agent failed");
      } finally {
        setBusy(false);
      }
    },
    [session.token, speak],
  );

  const startListening = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError("Speech recognition is not supported in this browser. Try Chrome.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-GB";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        void respond(transcript);
      }
    };

    recognition.start();
  }, [respond]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const startCall = async () => {
    setActive(true);
    setError(null);
    setReportMessage(null);
    setCallSummary(null);
    historyRef.current = [];
    setTurns([]);

    const greeting = `Hi ${session.contactName}, this is UpFlow calling about invoice ${session.invoiceNumber}. It's currently ${session.daysOverdue} days overdue for ${gbp(session.amountDue)}. Can you share when we might expect payment?`;
    const assistantTurn: Turn = { role: "assistant", content: greeting };
    historyRef.current = [assistantTurn];
    setTurns([assistantTurn]);
    await speak(greeting);
  };

  const endCall = () => {
    stopListening();
    window.speechSynthesis?.cancel();
    setActive(false);
    setBusy(false);

    const transcript = historyRef.current;
    if (transcript.length === 0) {
      return;
    }

    setSendingReport(true);
    setError(null);
    void completeVoiceCall(session.token, transcript)
      .then((report) => {
        setCallSummary(report.summary);
        setReportMessage(report.message);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to send call report");
      })
      .finally(() => {
        setSendingReport(false);
      });
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border hairline bg-surface-2/60 p-5">
        <div className="text-sm text-muted-foreground">Collections call</div>
        <div className="mt-1 text-lg font-semibold">{session.contactName}</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {session.invoiceNumber} · {session.daysOverdue}d overdue · {gbp(session.amountDue)}
        </div>
      </div>

      <div className="rounded-xl border hairline bg-surface-2/40 p-4">
        <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Transcript</div>
        <div className="max-h-64 space-y-3 overflow-y-auto text-sm">
          {turns.length === 0 ? (
            <p className="text-muted-foreground">Start the call to begin speaking with the agent.</p>
          ) : (
            turns.map((turn, index) => (
              <div key={`${turn.role}-${index}`}>
                <span className="font-medium">
                  {turn.role === "user" ? "You" : "Agent"}:
                </span>{" "}
                {turn.content}
              </div>
            ))
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-critical/30 bg-critical/10 p-3 text-sm text-critical">
          {error}
        </p>
      )}

      {sendingReport && (
        <p className="rounded-md border hairline bg-surface-2/40 p-3 text-sm text-muted-foreground">
          Generating summary and sending call report…
        </p>
      )}

      {callSummary && (
        <div className="rounded-xl border hairline bg-surface-2/40 p-4">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            Call summary
          </div>
          <p className="whitespace-pre-wrap text-sm">{callSummary}</p>
          {reportMessage && (
            <p className="mt-3 text-xs text-muted-foreground">{reportMessage}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {!active ? (
          <Button onClick={() => void startCall()} size="lg">
            Start call
          </Button>
        ) : (
          <>
            <Button
              onClick={listening ? stopListening : startListening}
              disabled={busy}
              size="lg"
              variant={listening ? "destructive" : "default"}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : listening ? (
                <MicOff className="size-4" />
              ) : (
                <Mic className="size-4" />
              )}
              {busy ? "Agent thinking…" : listening ? "Stop listening" : "Speak"}
            </Button>
            <Button variant="outline" onClick={endCall} size="lg" className="border-hairline">
              <PhoneOff className="size-4" />
              End call
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
}

declare const SpeechRecognition: {
  new (): SpeechRecognition;
};

declare const webkitSpeechRecognition: {
  new (): SpeechRecognition;
};
