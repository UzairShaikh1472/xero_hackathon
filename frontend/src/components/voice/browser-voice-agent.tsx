import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, PhoneOff, Send, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { completeVoiceCall, sendVoiceChat, type VoiceSessionData } from "@/lib/kinetic/api";
import { gbp } from "@/lib/kinetic/format";

type Turn = { role: "user" | "assistant"; content: string };

export function BrowserVoiceAgent({ session }: { session: VoiceSessionData }) {
  const [active, setActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [typedReply, setTypedReply] = useState("");
  const [micStatus, setMicStatus] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [callSummary, setCallSummary] = useState<string | null>(null);
  const [sendingReport, setSendingReport] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const historyRef = useRef<Turn[]>([]);
  const keepListeningRef = useRef(false);
  const heardResultRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);

  const isReengagement = session.draftType === "reengagement_quote";
  const legalTotal = !isReengagement
    ? session.overdueBalanceWithCharges ?? session.amountDue
    : undefined;
  const principalAmount = !isReengagement
    ? session.principalAmount ?? session.amountDue
    : undefined;
  const interestAmount = session.statutoryInterest ?? 0;
  const compensationAmount = session.fixedCompensation ?? 0;

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current != null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const scheduleListeningRestart = useCallback(
    (restart: () => void) => {
      clearRestartTimer();
      setListening(true);
      restartTimerRef.current = window.setTimeout(() => {
        if (keepListeningRef.current && !heardResultRef.current && !busy && !speaking) {
          restart();
        }
      }, 250);
    },
    [busy, clearRestartTimer, speaking],
  );

  const speak = useCallback((text: string, audioUrl?: string) => {
    return new Promise<void>((resolve) => {
      audioRef.current?.pause();
      audioRef.current = null;

      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        setSpeaking(true);
        audio.onended = () => {
          setSpeaking(false);
          audioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          setSpeaking(false);
          audioRef.current = null;
          void speak(text).then(resolve);
        };
        void audio.play().catch(() => {
          setSpeaking(false);
          audioRef.current = null;
          void speak(text).then(resolve);
        });
        return;
      }

      if (!("speechSynthesis" in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      setSpeaking(true);
      utterance.onend = () => {
        setSpeaking(false);
        resolve();
      };
      utterance.onerror = () => {
        setSpeaking(false);
        resolve();
      };
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const respond = useCallback(
    async (message: string) => {
      setBusy(true);
      setError(null);
      setLiveTranscript("");
      setMicStatus(null);
      const userTurn: Turn = { role: "user", content: message };
      const nextHistory = [...historyRef.current, userTurn];
      historyRef.current = nextHistory;
      setTurns(nextHistory);

      try {
        const voiceReply = await sendVoiceChat(session.token, message, historyRef.current);
        const assistantTurn: Turn = { role: "assistant", content: voiceReply.reply };
        historyRef.current = [...historyRef.current, assistantTurn];
        setTurns([...historyRef.current]);
        await speak(voiceReply.reply, voiceReply.audioUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Voice agent failed");
      } finally {
        setBusy(false);
      }
    },
    [session.token, speak],
  );

  const stopListening = useCallback(() => {
    keepListeningRef.current = false;
    heardResultRef.current = false;
    clearRestartTimer();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setMicStatus(null);
  }, [clearRestartTimer]);

  const startListening = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setError("Speech recognition is not supported in this browser. Try Chrome.");
      return;
    }

    if (busy || speaking) {
      return;
    }

    clearRestartTimer();
    recognitionRef.current?.stop();
    keepListeningRef.current = true;
    heardResultRef.current = false;
    setError(null);
    setListening(true);
    setLiveTranscript("");
    setMicStatus("Listening");

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-GB";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      recognitionRef.current = null;

      if (!keepListeningRef.current || heardResultRef.current || busy || speaking) {
        setListening(false);
        setMicStatus(null);
        return;
      }

      setMicStatus("Still listening");
      scheduleListeningRestart(startListening);
    };
    recognition.onerror = (event) => {
      const errorName = (event as { error?: string }).error;
      recognitionRef.current = null;
      if (
        keepListeningRef.current &&
        !heardResultRef.current &&
        errorName !== "not-allowed" &&
        errorName !== "service-not-allowed"
      ) {
        scheduleListeningRestart(startListening);
        return;
      }

      keepListeningRef.current = false;
      setListening(false);
      setMicStatus(null);
      if (errorName === "not-allowed" || errorName === "service-not-allowed") {
        setError("Microphone permission is blocked. Allow microphone access and try again.");
      } else if (errorName) {
        setError(`Microphone did not return speech (${errorName}). Type your reply below or try Speak again.`);
      }
    };
    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript?.trim();
        if (!transcript) {
          continue;
        }
        if (result.isFinal) {
          finalTranscript = `${finalTranscript} ${transcript}`.trim();
        } else {
          interimTranscript = `${interimTranscript} ${transcript}`.trim();
        }
      }

      if (interimTranscript) {
        setLiveTranscript(interimTranscript);
        setMicStatus("Hearing you");
      }

      if (!finalTranscript) {
        return;
      }

      heardResultRef.current = true;
      keepListeningRef.current = false;
      clearRestartTimer();
      setLiveTranscript(finalTranscript);
      setMicStatus(null);
      recognition.stop();
      void respond(finalTranscript);
    };

    recognition.start();
  }, [busy, clearRestartTimer, respond, scheduleListeningRestart, speaking]);

  const startCall = async () => {
    setActive(true);
    setError(null);
    setReportMessage(null);
    setCallSummary(null);
    setSendingReport(false);
    setLiveTranscript("");
    setTypedReply("");
    setMicStatus(null);
    historyRef.current = [];
    setTurns([]);

    try {
      const greeting = await sendVoiceChat(session.token, "__START_CALL__", []);
      const assistantTurn: Turn = { role: "assistant", content: greeting.reply };
      historyRef.current = [assistantTurn];
      setTurns([assistantTurn]);
      await speak(greeting.reply, greeting.audioUrl);
    } catch (err) {
      const fallbackGreeting = isReengagement
        ? `Hi ${session.contactName}, this is UpFlow. I wanted to check whether you have any upcoming work we can help with, or whether you would like a refreshed quote.`
        : legalTotal != null
          ? `Hi ${session.contactName}, this is UpFlow calling about ${session.invoiceNumber}. This invoice is still overdue, and the current estimated UK late-payment balance is ${session.currency} ${legalTotal.toFixed(2)}. Is payment scheduled, or is anything blocking it on your side?`
          : `Hi ${session.contactName}, this is UpFlow calling about ${session.invoiceNumber}. This invoice is still overdue, so I wanted to check whether payment is scheduled or whether anything is blocking it on your side.`;
      const assistantTurn: Turn = { role: "assistant", content: fallbackGreeting };
      historyRef.current = [assistantTurn];
      setTurns([assistantTurn]);
      setError(err instanceof Error ? err.message : "Voice agent failed to start cleanly");
      await speak(fallbackGreeting);
    }
  };

  const endCall = () => {
    stopListening();
    audioRef.current?.pause();
    audioRef.current = null;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setActive(false);
    setBusy(false);
    setLiveTranscript("");
    setTypedReply("");
    setMicStatus(null);

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
      stopListening();
      audioRef.current?.pause();
      audioRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, [stopListening]);

  const submitTypedReply = () => {
    const message = typedReply.trim();
    if (!message || busy || speaking) {
      return;
    }
    stopListening();
    setTypedReply("");
    void respond(message);
  };

  const replayLastAgent = () => {
    const lastAgentTurn = [...historyRef.current].reverse().find((turn) => turn.role === "assistant");
    if (lastAgentTurn && !busy && !speaking) {
      void speak(lastAgentTurn.content);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border hairline bg-surface-2/60 p-5">
        <div className="text-sm text-muted-foreground">
          {isReengagement ? "Reactivation call" : "Collections call"}
        </div>
        <div className="mt-1 text-lg font-semibold">{session.contactName}</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {isReengagement
            ? `${session.daysSinceLastActivity ?? session.daysOverdue}d inactive | ${gbp(session.amountDue)}`
            : `${session.invoiceNumber} | ${session.daysOverdue}d overdue | ${gbp(session.amountDue)}`}
        </div>
        {!isReengagement && legalTotal != null && principalAmount != null ? (
          <div className="mt-2 text-sm text-muted-foreground">
            Original {gbp(principalAmount)} | Interest {gbp(interestAmount)} | Recovery fee {gbp(compensationAmount)} | Legal total {gbp(legalTotal)}
          </div>
        ) : null}
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

      {(listening || liveTranscript || micStatus) && (
        <div className="rounded-xl border hairline bg-surface-2/40 p-4 text-sm">
          <div className="font-medium">{micStatus ?? "Captured speech"}</div>
          <div className="mt-1 text-muted-foreground">
            {liveTranscript || "Speak now. I will show what the browser hears here."}
          </div>
        </div>
      )}

      {sendingReport && (
        <p className="rounded-md border hairline bg-surface-2/40 p-3 text-sm text-muted-foreground">
          Generating summary and sending call report...
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
              disabled={busy || speaking}
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
              {busy
                ? "Agent thinking..."
                : speaking
                  ? "Wait for agent"
                  : listening
                    ? "Stop listening"
                    : "Speak"}
            </Button>
            <Button variant="outline" onClick={endCall} size="lg" className="border-hairline">
              <PhoneOff className="size-4" />
              End call
            </Button>
            <Button
              variant="outline"
              onClick={replayLastAgent}
              size="lg"
              className="border-hairline"
              disabled={busy || speaking || turns.length === 0}
            >
              <Volume2 className="size-4" />
              Replay
            </Button>
          </>
        )}
      </div>

      {active && (
        <div className="rounded-xl border hairline bg-surface-2/40 p-3">
          <div className="flex gap-2">
            <Textarea
              value={typedReply}
              onChange={(event) => setTypedReply(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitTypedReply();
                }
              }}
              rows={2}
              placeholder="Type reply if mic does not capture..."
              className="min-h-12 flex-1 resize-none bg-surface"
              disabled={busy || speaking}
            />
            <Button
              type="button"
              aria-label="Send typed reply"
              onClick={submitTypedReply}
              disabled={!typedReply.trim() || busy || speaking}
              className="self-stretch"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      )}
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
  resultIndex: number;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous?: boolean;
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

