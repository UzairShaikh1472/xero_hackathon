import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Pause, Phone, Play, PhoneOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { gbp } from "@/lib/kinetic/format";
import { fetchVoiceCallScript, fetchVoiceTts } from "@/lib/kinetic/escalation-api";
import type { VoiceCallScript } from "@/lib/kinetic/escalation-types";
import { cn } from "@/lib/utils";

interface JoinCallModalProps {
  invoiceId: string | null;
  contactName: string;
  open: boolean;
  onClose: () => void;
}

export function JoinCallModal({
  invoiceId,
  contactName,
  open,
  onClose,
}: JoinCallModalProps) {
  const [script, setScript] = useState<VoiceCallScript | null>(null);
  const [loading, setLoading] = useState(false);
  const [startingCall, setStartingCall] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [usingBrowserTts, setUsingBrowserTts] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const revokeAudioUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const stopSpeech = useCallback(() => {
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    revokeAudioUrl();
    setIsPlaying(false);
    setCallActive(false);
    setUsingBrowserTts(false);
    setStartingCall(false);
  }, [revokeAudioUrl]);

  const loadScript = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchVoiceCallScript(invoiceId);
      setScript(result);
    } catch (err) {
      setScript(null);
      setError(err instanceof Error ? err.message : "Could not load call script");
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    if (open && invoiceId) {
      void loadScript();
    } else {
      stopSpeech();
      setScript(null);
      setError(null);
    }
  }, [open, invoiceId, loadScript, stopSpeech]);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [stopSpeech]);

  const playBrowserTts = useCallback((speechText: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.onstart = () => {
      setIsPlaying(true);
      setCallActive(true);
      setUsingBrowserTts(true);
    };
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const playElevenLabsAudio = useCallback(
    (audioBase64: string, mimeType: string) => {
      revokeAudioUrl();
      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => {
        setIsPlaying(true);
        setCallActive(true);
        setUsingBrowserTts(false);
      };
      audio.onpause = () => setIsPlaying(false);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setError("Could not play ElevenLabs audio");
        setIsPlaying(false);
      };
      void audio.play();
    },
    [revokeAudioUrl],
  );

  const handleStartCall = async () => {
    if (!script?.speechText) return;
    setStartingCall(true);
    setError(null);
    stopSpeech();

    try {
      const tts = await fetchVoiceTts({
        text: script.speechText,
        invoiceId: script.invoiceId,
      });

      if (tts.fallback || !tts.audioBase64) {
        if (tts.message) {
          setError(`${tts.message} — using browser voice instead`);
        }
        playBrowserTts(script.speechText);
        return;
      }

      playElevenLabsAudio(tts.audioBase64, tts.mimeType ?? "audio/mpeg");
    } catch (err) {
      playBrowserTts(script.speechText);
      setError(
        err instanceof Error
          ? `${err.message} — using browser voice instead`
          : "ElevenLabs unavailable — using browser voice",
      );
    } finally {
      setStartingCall(false);
    }
  };

  const handlePause = () => {
    if (usingBrowserTts) {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        setIsPlaying(false);
      }
      return;
    }

    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleResume = () => {
    if (usingBrowserTts) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPlaying(true);
      }
      return;
    }

    if (audioRef.current) {
      void audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleEndCall = () => {
    stopSpeech();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleEndCall()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className={cn(
                "grid size-8 place-items-center rounded-full",
                callActive ? "bg-positive/15 text-positive" : "bg-muted text-muted-foreground",
              )}
            >
              <Phone className="size-4" />
            </div>
            Voice Agent Call
          </DialogTitle>
          <DialogDescription>
            Simulated collection call with {contactName}
            {usingBrowserTts && callActive ? " · browser voice" : callActive ? " · ElevenLabs" : ""}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <p className="text-sm text-muted-foreground">Loading call script…</p>
        )}

        {error && (
          <p className="text-sm text-critical">{error}</p>
        )}

        {script && !loading && (
          <div className="space-y-3">
            <div className="rounded-xl border hairline bg-surface-2/60 p-4 text-sm">
              <div className="font-medium">{script.contactName}</div>
              <div className="mt-1 text-muted-foreground">
                {script.invoiceNumber} · {gbp(script.amountDue)} ·{" "}
                {script.daysOverdue}d overdue
              </div>
            </div>

            <div className="rounded-xl border hairline bg-surface-2/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Mic className="size-3.5" />
                Agent script
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {script.speechText}
              </p>
            </div>

            {callActive && (
              <div className="flex items-center gap-2 text-sm text-positive">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-positive" />
                </span>
                Call in progress…
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button variant="ghost" onClick={handleEndCall}>
            <PhoneOff className="size-3.5" />
            End Call
          </Button>
          <div className="flex gap-2">
            {!callActive ? (
              <Button
                onClick={() => void handleStartCall()}
                disabled={!script || loading || startingCall}
              >
                <Play className="size-3.5" />
                {startingCall ? "Connecting…" : "Start Call"}
              </Button>
            ) : isPlaying ? (
              <Button variant="outline" onClick={handlePause}>
                <Pause className="size-3.5" />
                Pause
              </Button>
            ) : (
              <Button variant="outline" onClick={handleResume}>
                <Play className="size-3.5" />
                Resume
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
