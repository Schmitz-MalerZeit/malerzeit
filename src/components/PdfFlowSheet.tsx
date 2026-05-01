import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    if (!open) {
      setDiag(null);
      setShowDetails(false);
    }
  }, [open]);

  const waUrl = useMemo(() => {
    if (!state.whatsappText) return "";
    const base = state.whatsappPhone ? `https://wa.me/${state.whatsappPhone}` : "https://wa.me/";
    return `${base}?text=${encodeURIComponent(state.whatsappText)}`;
  }, [state.whatsappText, state.whatsappPhone]);

  const fetchPdfBlob = async (): Promise<Blob | null> => {
    if (!state.url) return null;
    try {
      const r = await fetch(state.url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.blob();
    } catch (e: any) {
      toast.error(e?.message || "Download fehlgeschlagen");
      return null;
    }
  };

  const downloadPdf = async () => {
    if (!state.url || !state.fileName) return;
    const blob = await fetchPdfBlob();
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = state.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const sharePdf = async () => {
    if (!state.url || !state.fileName) return;
    const blob = await fetchPdfBlob();
    if (!blob) return;
    const file = new File([blob], state.fileName, { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: state.subject, text: state.subject });
        return;
      } catch {
        /* user cancelled */
        return;
      }
    }
    toast.info("Direktes Teilen wird auf diesem Gerät nicht unterstützt. Bitte Download nutzen.");
  };

  const sendMail = () => {
    if (!state.subject || !state.emailBody) return;
    const body = `${state.emailBody}\n\nHinweis: Bitte die PDF nach dem Download als Anhang hinzufügen.`;
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
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div>
            <p className="text-base font-semibold">{phaseLabel[state.phase]}</p>
            {state.step && (
              <p className="mt-1 text-sm text-muted-foreground">{state.step}</p>
            )}
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
              <Button variant="secondary" className="h-11" onClick={() => {
                const a = document.createElement("a");
                a.href = fallbackUrl;
                a.download = fallbackFileName || "Preisorientierung.pdf";
                a.rel = "noopener";
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}>
                <FileDown className="h-4 w-4 mr-2" /> Letzte gespeicherte PDF laden
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
            <Button onClick={downloadPdf} className="h-11">
              <Download className="h-4 w-4 mr-2" /> Download
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
