import { useEffect, useRef, useState } from "react";
import { Mic, Loader2, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { voiceLock } from "@/lib/voiceLock";

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
  onTranscript, mode = "append", size = "sm", label = "Spracheingabe", className, disabled,
}: VoiceInputProps) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopAll = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
  };

  const start = async () => {
    if (disabled || busy) return;
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
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        stopAll();
        if (blob.size < 800) { toast.info("Aufnahme zu kurz"); return; }
        setBusy(true);
        try {
          const base64 = await blobToBase64(blob);
          const { data, error } = await supabase.functions.invoke("transcribe-audio", {
            body: { audio: base64, mimeType: blob.type },
          });
          if (error) throw error;
          const text = (data?.text || "").trim();
          if (!text) { toast.info("Nichts erkannt – bitte erneut versuchen"); return; }
          onTranscript(text);
        } catch (e: any) {
          toast.error(e?.message || "Transkription fehlgeschlagen");
        } finally { setBusy(false); }
      };
      rec.start();
      setRecording(true);
    } catch (e: any) {
      toast.error(
        e?.name === "NotAllowedError"
          ? "Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben."
          : "Mikrofon nicht verfügbar"
      );
      stopAll();
    }
  };

  const stop = () => {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    setRecording(false);
  };

  const onClick = () => (recording ? stop() : start());

  const sizes = size === "md" ? "h-10 w-10" : "h-8 w-8";
  const icon = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={recording ? "Aufnahme stoppen" : label}
      aria-label={recording ? "Aufnahme stoppen" : label}
      data-mode={mode}
      className={cn(
        "shrink-0 inline-flex items-center justify-center rounded-lg border transition-base",
        sizes,
        recording
          ? "bg-destructive/10 border-destructive text-destructive animate-pulse"
          : busy
          ? "bg-secondary border-border text-muted-foreground"
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
