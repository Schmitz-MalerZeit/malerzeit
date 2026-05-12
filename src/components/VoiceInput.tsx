import { useEffect, useRef, useState } from "react";
import { Mic, Loader2, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { voiceLock } from "@/lib/voiceLock";
import { tr } from "@/lib/tr";

interface VoiceInputProps {
  /** Called with the transcribed text. The component does not modify state itself. */
  onTranscript: (text: string) => void;
  /** Append (default) or replace existing field content – purely a hint for the parent. */
  mode?: "append" | "replace";
  /** Visual size */
  size?: "sm" | "md";
  /** Optional aria-label / title (e.g. "Beschreibung diktieren"). */
  label?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Small mic button that records audio and transcribes it via the
 * `transcribe-audio` edge function (Lovable AI Gateway → Gemini multimodal).
 *
 * Click to start, click again to stop. While transcribing a spinner is shown.
 */
export function VoiceInput({
  onTranscript, mode = "append", size = "sm", label, className, disabled,
}: VoiceInputProps) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [otherActive, setOtherActive] = useState(false);
  const idRef = useRef<number>(voiceLock.nextId());
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopAll = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
  };

  // Keep "another mic is active" disabled-state in sync with the global lock.
  useEffect(() => {
    const myId = idRef.current;
    const unsub = voiceLock.subscribe((active) => {
      setOtherActive(active !== null && active !== myId);
    });
    // Register a remote-stop hook so the lock owner stays unique even if state desyncs.
    const unreg = voiceLock.registerStopper(myId, () => {
      if (recRef.current && recRef.current.state !== "inactive") {
        try { recRef.current.stop(); } catch { /* ignore */ }
      }
      stopAll();
      setRecording(false);
      voiceLock.release(myId);
    });
    return () => {
      unsub();
      unreg();
      voiceLock.release(myId);
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    if (disabled || busy) return;
    // Try to acquire global mic lock — only one VoiceInput can record/transcribe at a time.
    if (!voiceLock.acquire(idRef.current)) {
      toast.info(tr("Bitte erst die laufende Spracheingabe beenden.", "Please stop the running voice input first."));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4"
        : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      // Falls iOS die Aufnahme von außen beendet (Statusleiste antippen, anderer Anruf,
      // Hintergrund-Wechsel), feuert MediaRecorder.onstop nicht zuverlässig. Wir hängen
      // uns deshalb an das 'ended'-Event des Audio-Tracks und stoßen den Stop manuell an.
      stream.getAudioTracks().forEach((t) => {
        t.addEventListener("ended", () => {
          if (recRef.current && recRef.current.state !== "inactive") {
            try { recRef.current.stop(); } catch { /* ignore */ }
          }
          setRecording(false);
        });
      });
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        stopAll();
        if (blob.size < 800) {
          toast.info(tr("Aufnahme zu kurz", "Recording too short"));
          voiceLock.release(idRef.current);
          return;
        }
        setBusy(true);
        try {
          const base64 = await blobToBase64(blob);
          const { data, error } = await supabase.functions.invoke("transcribe-audio", {
            body: { audio: base64, mimeType: blob.type },
          });
          if (error) throw error;
          const text = (data?.text || "").trim();
          if (!text) { toast.info(tr("Nichts erkannt – bitte erneut versuchen", "Nothing recognized – please try again")); return; }
          onTranscript(text);
        } catch (e: any) {
          toast.error(e?.message || tr("Transkription fehlgeschlagen", "Transcription failed"));
        } finally {
          setBusy(false);
          // Release lock only after transcription finishes — keeps other mics disabled
          // during the whole "recording + transcription" lifecycle.
          voiceLock.release(idRef.current);
        }
      };
      // timeslice = 1000ms: ondataavailable feuert jede Sekunde, damit auch
      // sehr lange Aufnahmen (Nutzer spricht parallel mit Kunde) verlustfrei
      // gepuffert werden, falls das System die MediaRecorder-Session vorzeitig
      // beendet (z. B. iOS bei Hintergrund/Lock).
      rec.start(1000);
      setRecording(true);
    } catch (e: any) {
      toast.error(
        e?.name === "NotAllowedError"
          ? tr("Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.", "Microphone access denied. Please allow it in your browser settings.")
          : tr("Mikrofon nicht verfügbar", "Microphone not available")
      );
      stopAll();
      voiceLock.release(idRef.current);
    }
  };

  const stop = () => {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    setRecording(false);
  };

  const onClick = () => (recording ? stop() : start());

  // iOS-PWA-Fix: Wenn der Cursor in einem Input/Textarea steht und der Nutzer auf den
  // Mikro-Button tippt, "frisst" iOS den ersten Tap, um die Tastatur zu schließen
  // (Input verliert Fokus). Erst der zweite Tap löst dann tatsächlich den onClick aus.
  // Lösung: pointerdown abfangen, default verhindern – damit das Input den Fokus behält
  // und der erste Tap direkt als Klick zählt (Gesture-Chain für getUserMedia bleibt erhalten).
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Nur Touch/Pen abfangen – auf Desktop normales Klick-Verhalten beibehalten,
    // damit Buttons mit Tab/Space weiter fokussierbar bleiben.
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      e.preventDefault();
    }
  };

  const sizes = size === "md" ? "h-10 w-10" : "h-8 w-8";
  const icon = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  // Disabled when: explicitly disabled, while transcribing this instance, or while ANOTHER mic owns the lock.
  const isDisabled = disabled || busy || (otherActive && !recording);

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      style={{ touchAction: "manipulation" }}
      disabled={isDisabled}
      title={recording
        ? tr("Aufnahme stoppen", "Stop recording")
        : (otherActive
          ? tr("Eine andere Spracheingabe läuft gerade", "Another voice input is currently running")
          : (label || tr("Spracheingabe", "Voice input")))}
      aria-label={recording ? tr("Aufnahme stoppen", "Stop recording") : (label || tr("Spracheingabe", "Voice input"))}
      data-mode={mode}
      className={cn(
        "shrink-0 inline-flex items-center justify-center rounded-lg border transition-base",
        sizes,
        recording
          ? "bg-destructive/10 border-destructive text-destructive animate-pulse"
          : busy
          ? "bg-secondary border-border text-muted-foreground"
          : isDisabled
          ? "bg-muted border-border text-muted-foreground/60 cursor-not-allowed"
          : "bg-card border-border text-muted-foreground hover:text-primary hover:border-primary/40",
        className
      )}
    >
      {busy ? <Loader2 className={cn(icon, "animate-spin")} />
        : recording ? <Square className={cn(icon, "fill-current")} />
        : <Mic className={icon} />}
    </button>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const comma = dataUrl.indexOf(",");
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
