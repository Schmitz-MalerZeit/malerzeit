import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PdfPreviewRenderer, type PdfDiagnostics } from "@/components/PdfPreviewRenderer";
import { toast } from "sonner";
import {
  AlertCircle, CheckCircle2, Download, ExternalLink, FileDown, Loader2,
  MessageCircle, RefreshCw, X,
} from "lucide-react";

export type PdfFlowPhase =
  | "idle"
  | "building"        // assembling jsPDF
  | "uploading"       // upload + signing
  | "ready"           // signed URL available
  | "error";          // any failure

export interface PdfFlowState {
  phase: PdfFlowPhase;
  /** "Build PDF" / "Upload" / "Signed URL …" — what is happening right now */
  step?: string;
  /** 0..100 — overall progress for the current phase */
  progress?: number;
  /** bytes already transferred (upload phase) */
  loadedBytes?: number;
  /** total bytes to transfer (upload phase) */
  totalBytes?: number;
  /** estimated remaining seconds for the current phase */
  etaSeconds?: number;
  /** human-readable error if phase === "error" */
  errorMessage?: string;
  /** technical detail (stack, http status, …) shown in the details panel */
  errorDetail?: string;
  /** populated once the signed URL exists */
  url?: string;
  fileName?: string;
  subject?: string;
  emailBody?: string;
  whatsappText?: string;
  whatsappPhone?: string | null;
  /** Frischer PDF-Blob, falls vorhanden – wird für echte Datei-Anhänge via Web Share API verwendet. */
  pdfBlob?: Blob | null;
}

const fmtBytes = (b?: number) => {
  if (b == null || !isFinite(b)) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
};

const fmtEta = (s?: number) => {
  if (s == null || !isFinite(s) || s <= 0) return "";
  if (s < 1) return "weniger als 1 s";
  if (s < 60) return `ca. ${Math.ceil(s)} s`;
  const m = Math.floor(s / 60);
  const r = Math.ceil(s % 60);
  return `ca. ${m} min ${r} s`;
};

interface PdfFlowSheetProps {
  open: boolean;
  state: PdfFlowState;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  /** Optional fallback: previously saved PDF that can still be downloaded */
  fallbackUrl?: string | null;
  fallbackFileName?: string | null;
  /** Wird aufgerufen, NACHDEM eine Versand-Aktion (WhatsApp / Mail / Teilen)
   * ausgelöst wurde – damit die Hostseite z. B. zur Liste der gespeicherten
   * Vorschläge wechseln kann, bevor der Nutzer von WhatsApp zurückkommt. */
  onAfterShareAction?: () => void;
}

const phaseLabel: Record<PdfFlowPhase, string> = {
  idle: "Bereit",
  building: "PDF wird erstellt …",
  uploading: "PDF wird gespeichert …",
  ready: "PDF bereit",
  error: "PDF konnte nicht erstellt werden",
};

export function PdfFlowSheet({
  open, state, onOpenChange, onRetry, fallbackUrl, fallbackFileName, onAfterShareAction,
}: PdfFlowSheetProps) {
  const [diag, setDiag] = useState<PdfDiagnostics | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [fetchedBlob, setFetchedBlob] = useState<Blob | null>(null);
  const [fetchingBlob, setFetchingBlob] = useState(false);

  const toAttachmentUrl = (url: string, fileName?: string | null) => {
    if (!url || url.startsWith("blob:")) return url;
    try {
      const u = new URL(url);
      u.searchParams.set("download", fileName || "Preisorientierung.pdf");
      return u.toString();
    } catch {
      const sep = url.includes("?") ? "&" : "?";
      return `${url}${sep}download=${encodeURIComponent(fileName || "Preisorientierung.pdf")}`;
    }
  };

  useEffect(() => {
    if (!open) {
      setDiag(null);
      setShowDetails(false);
      setFetchedBlob(null);
      setFetchingBlob(false);
    }
  }, [open]);

  // Falls keine frische Blob-Quelle vorhanden ist (z. B. PDF aus „Gespeicherte
  // Vorschläge"), holen wir die Datei einmal von der signierten URL, damit
  // alle Share-Pfade einen echten File-Anhang versenden können.
  useEffect(() => {
    if (state.phase !== "ready") return;
    if (state.pdfBlob || fetchedBlob || fetchingBlob) return;
    if (!state.url || state.url.startsWith("blob:")) return;
    let cancelled = false;
    setFetchingBlob(true);
    fetch(state.url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((b) => { if (!cancelled) setFetchedBlob(b); })
      .catch((e) => console.warn("Konnte PDF nicht für Anhang vorladen:", e))
      .finally(() => { if (!cancelled) setFetchingBlob(false); });
    return () => { cancelled = true; };
  }, [state.phase, state.url, state.pdfBlob, fetchedBlob, fetchingBlob]);

  const downloadUrl = useMemo(
    () => state.url ? toAttachmentUrl(state.url, state.fileName) : "",
    [state.url, state.fileName],
  );

  const fallbackDownloadUrl = useMemo(
    () => fallbackUrl ? toAttachmentUrl(fallbackUrl, fallbackFileName) : "",
    [fallbackUrl, fallbackFileName],
  );

  const pdfFile = useMemo<File | null>(() => {
    const blob = state.pdfBlob || fetchedBlob;
    if (!blob) return null;
    const name = state.fileName || "Preisorientierung.pdf";
    try {
      return new File([blob], name, { type: blob.type || "application/pdf" });
    } catch {
      return null;
    }
  }, [state.pdfBlob, fetchedBlob, state.fileName]);

  const canShareFile = useMemo(() => {
    if (!pdfFile) return false;
    const navAny = navigator as any;
    return typeof navAny.canShare === "function" && navAny.canShare({ files: [pdfFile] });
  }, [pdfFile]);

  const waUrl = useMemo(() => {
    if (!state.whatsappText) return "";
    const base = state.whatsappPhone ? `https://wa.me/${state.whatsappPhone}` : "https://wa.me/";
    return `${base}?text=${encodeURIComponent(state.whatsappText)}`;
  }, [state.whatsappText, state.whatsappPhone]);

  /** „Teilen" – immer mit Datei-Anhang, wenn das Gerät es unterstützt. */
  const sharePdf = async () => {
    if (canShareFile && pdfFile) {
      try {
        await (navigator as any).share({
          files: [pdfFile],
          title: state.subject || state.fileName,
          text: state.emailBody || state.subject || "",
        });
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.warn("File-Share fehlgeschlagen, Fallback:", e);
      }
    }
    // Fallback: nur Link/Text teilen
    const url = downloadUrl || state.url;
    if (navigator.share && url) {
      try {
        await navigator.share({ title: state.subject || state.fileName, text: state.subject, url });
        return;
      } catch { return; }
    }
    if (url) {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("PDF-Link kopiert");
        return;
      } catch { /* ignore */ }
    }
    toast.error("Teilen ist auf diesem Gerät nicht verfügbar.");
  };

  /** WhatsApp – versucht zuerst echten Datei-Anhang via Share-Sheet. */
  const sendWhatsapp = async () => {
    if (canShareFile && pdfFile) {
      try {
        await (navigator as any).share({
          files: [pdfFile],
          title: state.subject || state.fileName,
          text: state.whatsappText || state.subject || "",
        });
        toast.message("Wähle WhatsApp im Teilen-Menü", {
          description: "Die PDF wird dann als Datei mitgeschickt.",
        });
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.warn("WhatsApp File-Share fehlgeschlagen, Fallback wa.me:", e);
      }
    }
    if (!waUrl) return;
    // Lade die PDF lokal herunter, damit sie in WhatsApp angehängt werden kann.
    if (downloadUrl) {
      try {
        const dl = document.createElement("a");
        dl.href = downloadUrl;
        dl.download = state.fileName || "Preisorientierung.pdf";
        dl.rel = "noopener";
        document.body.appendChild(dl);
        dl.click();
        document.body.removeChild(dl);
      } catch { /* ignore */ }
    }
    toast.message("PDF wurde heruntergeladen", {
      description: "WhatsApp öffnet sich – hänge die PDF aus dem Download-Ordner an.",
    });
    const a = document.createElement("a");
    a.href = waUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /**
   * E-Mail – echter Datei-Anhang via Share-Sheet, sonst `mailto:` über
   * unsichtbaren `<a>`-Klick (nicht via `location.href`, weil das auf manchen
   * mobilen Browsern den Tab-State invalidiert und der Sheet-Inhalt nach
   * Rückkehr neu gebaut werden müsste).
   */
  const sendMail = async () => {
    if (canShareFile && pdfFile) {
      try {
        await (navigator as any).share({
          files: [pdfFile],
          title: state.subject || state.fileName,
          text: state.emailBody || state.subject || "",
        });
        toast.message("Wähle deine E-Mail-App im Teilen-Menü", {
          description: "Die PDF wird dann als echter Anhang mitgeschickt.",
        });
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.warn("Mail File-Share fehlgeschlagen, Fallback mailto:", e);
      }
    }
    if (!state.subject || !state.emailBody) return;
    // Lade die PDF zuerst lokal herunter, damit der Nutzer sie im Mail-Client
    // direkt aus dem Download-Ordner anhängen kann.
    if (downloadUrl) {
      try {
        const dl = document.createElement("a");
        dl.href = downloadUrl;
        dl.download = state.fileName || "Preisorientierung.pdf";
        dl.rel = "noopener";
        document.body.appendChild(dl);
        dl.click();
        document.body.removeChild(dl);
      } catch { /* ignore */ }
    }
    toast.message("PDF wurde heruntergeladen", {
      description: "Hänge sie im E-Mail-Programm aus dem Download-Ordner an.",
    });
    // mailto über unsichtbaren Link – verändert nicht die aktuelle URL der App
    const a = document.createElement("a");
    a.href = `mailto:?subject=${encodeURIComponent(state.subject)}&body=${encodeURIComponent(state.emailBody)}`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openInBrowser = () => {
    if (!state.url) return;
    window.open(state.url, "_blank", "noopener,noreferrer");
  };

  const renderBody = () => {
    if (state.phase === "building" || state.phase === "uploading") {
      const pct = typeof state.progress === "number"
        ? Math.max(0, Math.min(100, Math.round(state.progress)))
        : undefined;
      const showBytes = state.phase === "uploading" && (state.loadedBytes != null || state.totalBytes != null);
      const eta = fmtEta(state.etaSeconds);
      return (
        <div className="flex flex-col items-center justify-center gap-5 py-10 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="w-full max-w-sm">
            <p className="text-base font-semibold">{phaseLabel[state.phase]}</p>
            {state.step && (
              <p className="mt-1 text-sm text-muted-foreground">{state.step}</p>
            )}

            <div className="mt-4 space-y-1.5">
              <Progress value={pct ?? 0} className="h-2" />
              <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>{pct != null ? `${pct}%` : "…"}</span>
                <span>
                  {showBytes && state.totalBytes
                    ? `${fmtBytes(state.loadedBytes ?? 0)} / ${fmtBytes(state.totalBytes)}`
                    : showBytes
                      ? fmtBytes(state.loadedBytes)
                      : ""}
                </span>
              </div>
              {eta && (
                <p className="text-[11px] text-muted-foreground">Verbleibend: {eta}</p>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (state.phase === "error") {
      return (
        <div className="flex flex-col gap-4 py-6">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-base font-semibold text-destructive">{phaseLabel.error}</p>
              <p className="mt-1 text-sm text-muted-foreground break-words">
                {state.errorMessage || "Unbekannter Fehler."}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={onRetry} className="h-11">
              <RefreshCw className="h-4 w-4 mr-2" /> Erneut versuchen
            </Button>
            {fallbackUrl && (
              <Button asChild variant="secondary" className="h-11">
                <a href={fallbackDownloadUrl} download={fallbackFileName || "Preisorientierung.pdf"} target="_blank" rel="noopener noreferrer">
                  <FileDown className="h-4 w-4 mr-2" /> Letzte gespeicherte PDF laden
                </a>
              </Button>
            )}
            <Button variant="ghost" className="h-9" onClick={() => onOpenChange(false)}>
              Schließen
            </Button>
          </div>

          {state.errorDetail && (
            <div className="rounded-md border border-border bg-muted p-3">
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {showDetails ? "Technische Details verbergen" : "Technische Details anzeigen"}
              </button>
              {showDetails && (
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed text-foreground">
{state.errorDetail}
                </pre>
              )}
            </div>
          )}
        </div>
      );
    }

    if (state.phase === "ready" && state.url) {
      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-xs text-foreground truncate">
              {state.fileName} ist bereit.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button asChild className="h-11">
              <a href={downloadUrl} download={state.fileName || "Preisorientierung.pdf"} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" /> Download
              </a>
            </Button>
            <Button variant="outline" onClick={sendWhatsapp} className="h-11">
              <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
            </Button>
            <Button variant="secondary" onClick={openInBrowser} className="h-11 col-span-2">
              <ExternalLink className="h-4 w-4 mr-2" /> Im Browser öffnen
            </Button>
          </div>

          <div className="rounded-md border border-border overflow-hidden h-[40vh] min-h-[260px]">
            <PdfPreviewRenderer url={state.url} onDiagnostics={setDiag} />
          </div>

          <Button variant="ghost" className="h-10 mt-1" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>

          {diag && (
            <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
              <span className="rounded border border-border bg-muted px-1.5 py-0.5">Quelle: {diag.urlKind}</span>
              {diag.httpStatus !== undefined && (
                <span className="rounded border border-border bg-muted px-1.5 py-0.5">HTTP {diag.httpStatus}</span>
              )}
              {typeof diag.fetchMs === "number" && (
                <span className="rounded border border-border bg-muted px-1.5 py-0.5">Fetch {diag.fetchMs} ms</span>
              )}
              {typeof diag.numPages === "number" && (
                <span className="rounded border border-border bg-muted px-1.5 py-0.5">{diag.numPages} Seiten</span>
              )}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85dvh] max-h-[85dvh] flex flex-col p-0 gap-0 rounded-t-2xl"
      >
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <SheetTitle className="text-base">PDF-Vorschlag</SheetTitle>
              <SheetDescription className="text-xs">
                {phaseLabel[state.phase]}
              </SheetDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label="Schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          {renderBody()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
