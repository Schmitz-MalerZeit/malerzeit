import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PdfPreviewRenderer, type PdfDiagnostics } from "@/components/PdfPreviewRenderer";
import { toast } from "sonner";
import {
  AlertCircle, CheckCircle2, Download, ExternalLink, FileDown, Loader2, Mail,
  MessageCircle, RefreshCw, Share2, X,
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
}

const phaseLabel: Record<PdfFlowPhase, string> = {
  idle: "Bereit",
  building: "PDF wird erstellt …",
  uploading: "PDF wird gespeichert …",
  ready: "PDF bereit",
  error: "PDF konnte nicht erstellt werden",
};

export function PdfFlowSheet({
  open, state, onOpenChange, onRetry, fallbackUrl, fallbackFileName,
}: PdfFlowSheetProps) {
  const [diag, setDiag] = useState<PdfDiagnostics | null>(null);
  const [showDetails, setShowDetails] = useState(false);

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
    }
  }, [open]);

  const downloadUrl = useMemo(
    () => state.url ? toAttachmentUrl(state.url, state.fileName) : "",
    [state.url, state.fileName],
  );

  const fallbackDownloadUrl = useMemo(
    () => fallbackUrl ? toAttachmentUrl(fallbackUrl, fallbackFileName) : "",
    [fallbackUrl, fallbackFileName],
  );

  const waUrl = useMemo(() => {
    if (!state.whatsappText) return "";
    const base = state.whatsappPhone ? `https://wa.me/${state.whatsappPhone}` : "https://wa.me/";
    const text = downloadUrl ? `${state.whatsappText}\n\nPDF herunterladen: ${downloadUrl}` : state.whatsappText;
    return `${base}?text=${encodeURIComponent(text)}`;
  }, [downloadUrl, state.whatsappText, state.whatsappPhone]);

  const sharePdf = async () => {
    const url = downloadUrl || state.url;
    if (!url) return;

    if (navigator.share) {
      try {
        await navigator.share({ title: state.subject || state.fileName, text: state.subject, url });
        return;
      } catch {
        /* user cancelled */
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("PDF-Link kopiert");
    } catch {
      toast.error("Teilen ist auf diesem Gerät nicht verfügbar.");
    }
  };

  const sendMail = () => {
    if (!state.subject || !state.emailBody) return;
    const linkLine = downloadUrl ? `\n\nPDF herunterladen: ${downloadUrl}` : "";
    const body = `${state.emailBody}${linkLine}\n\nHinweis: Falls kein Anhang möglich ist, kann die PDF über den Link geöffnet und gespeichert werden.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(state.subject)}&body=${encodeURIComponent(body)}`;
  };

  const sendWhatsapp = () => {
    if (!waUrl) return;
    window.open(waUrl, "_blank", "noopener,noreferrer");
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
            <Button variant="outline" onClick={sharePdf} className="h-11">
              <Share2 className="h-4 w-4 mr-2" /> Teilen
            </Button>
            <Button variant="outline" onClick={sendMail} className="h-11">
              <Mail className="h-4 w-4 mr-2" /> E-Mail
            </Button>
            <Button variant="outline" onClick={sendWhatsapp} className="h-11">
              <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
            </Button>
            <Button variant="secondary" onClick={openInBrowser} className="h-11 col-span-2">
              <ExternalLink className="h-4 w-4 mr-2" /> Im Browser öffnen
            </Button>
          </div>

          <div className="rounded-md border border-border overflow-hidden h-[55vh] min-h-[320px]">
            <PdfPreviewRenderer url={state.url} onDiagnostics={setDiag} />
          </div>

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
        className="h-[92dvh] max-h-[92dvh] flex flex-col p-0 gap-0 rounded-t-2xl"
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
