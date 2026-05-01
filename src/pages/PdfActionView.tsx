import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, ExternalLink, FileDown, Loader2, Mail, MailPlus, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfPreviewRenderer, type PdfDiagnostics } from "@/components/PdfPreviewRenderer";
import { toast } from "sonner";

interface PdfActionOptions {
  url: string;
  fileName: string;
  subject: string;
  emailBody: string;
  whatsappText: string;
  whatsappPhone?: string | null;
}

export default function PdfActionView() {
  const nav = useNavigate();
  const [options, setOptions] = useState<PdfActionOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const [diag, setDiag] = useState<PdfDiagnostics | null>(null);

  useEffect(() => {
    // Try token-scoped payload first (set by the opener), then fall back to
    // the "latest" copy for same-tab navigation.
    const hash = window.location.hash || "";
    const tokenMatch = hash.match(/token=([A-Za-z0-9-]+)/);
    const keys = [
      tokenMatch ? `pdfActionOptions:${tokenMatch[1]}` : null,
      "pdfActionOptions",
    ].filter(Boolean) as string[];
    for (const key of keys) {
      const raw = key.startsWith("pdfActionOptions:")
        ? localStorage.getItem(key)
        : sessionStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        setOptions(parsed);
        sessionStorage.setItem("pdfActionOptions", JSON.stringify(parsed));
        // Cleanup the one-shot token entry, keep "latest" for reloads.
        if (key.startsWith("pdfActionOptions:")) localStorage.removeItem(key);
        return;
      } catch {
        if (key.startsWith("pdfActionOptions:")) localStorage.removeItem(key);
        else sessionStorage.removeItem(key);
      }
    }
  }, []);

  const waUrl = useMemo(() => {
    if (!options) return "";
    const base = options.whatsappPhone ? `https://wa.me/${options.whatsappPhone}` : "https://wa.me/";
    return `${base}?text=${encodeURIComponent(options.whatsappText)}`;
  }, [options]);

  const fetchPdfBlob = async () => {
    if (!options) throw new Error("Keine PDF geladen");
    const response = await fetch(options.url);
    if (!response.ok) throw new Error("PDF konnte nicht geladen werden");
    return await response.blob();
  };

  const downloadPdf = async () => {
    if (!options) return;
    setBusy(true);
    try {
      const blob = await fetchPdfBlob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = options.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error: any) {
      toast.error(error.message || "Download fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const downloadStoredPdf = () => {
    if (!options) return;
    const link = document.createElement("a");
    link.href = options.url;
    link.download = options.fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const openStoredPdf = () => {
    if (!options) return;
    window.open(options.url, "_blank", "noopener,noreferrer");
  };

  const emailStoredPdf = async () => {
    if (!options) return;
    toast.info("Teilen-Fenster geöffnet – bitte Mail auswählen, damit die PDF als Anhang übernommen wird.");
    if (await sharePdf()) return;
    const note = "Hinweis: Die gespeicherte PDF ist auf Ihrem Gerät verfügbar – bitte vor dem Senden als Anhang hinzufügen.";
    const body = `${options.emailBody}\n\n${note}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(options.subject)}&body=${encodeURIComponent(body)}`;
    toast.info("Direkter PDF-Anhang wird auf diesem Gerät nicht unterstützt. Bitte PDF manuell anhängen.");
  };

  const sharePdf = async () => {
    if (!options) return false;
    setBusy(true);
    try {
      const blob = await fetchPdfBlob();
      const file = new File([blob], options.fileName, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: options.subject, text: options.subject });
        return true;
      }
      toast.info("Direktes Teilen wird auf diesem Gerät nicht unterstützt. Bitte Download nutzen und die PDF anhängen.");
      return false;
    } catch (error: any) {
      toast.error(error.message || "Teilen fehlgeschlagen");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const sendMail = async () => {
    if (!options) return;
    if (await sharePdf()) return;
    window.location.href = `mailto:?subject=${encodeURIComponent(options.subject)}&body=${encodeURIComponent(options.emailBody)}`;
  };

  const sendWhatsapp = async () => {
    if (!options) return;
    if (await sharePdf()) return;
    window.location.href = waUrl;
  };

  const goBack = () => {
    if (window.history.length > 1) nav(-1);
    else window.close();
  };

  if (!options) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center text-muted-foreground">
        Keine PDF-Daten gefunden.
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-card px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 space-y-2">
        <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
          <Button type="button" variant="outline" onClick={goBack} className="h-11 px-3" aria-label="Zurück">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button type="button" onClick={downloadPdf} disabled={busy} className="h-11 min-w-0">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Download className="h-4 w-4 mr-2" />Download</>}
          </Button>
          <Button type="button" variant="outline" onClick={sharePdf} disabled={busy} className="h-11 min-w-0">
            <Share2 className="h-4 w-4 mr-2" />Teilen
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={sendMail} disabled={busy} className="h-11 min-w-0">
            <Mail className="h-4 w-4 mr-2" />E-Mail
          </Button>
          <Button type="button" variant="outline" onClick={sendWhatsapp} disabled={busy} className="h-11 min-w-0">
            <MessageCircle className="h-4 w-4 mr-2" />WhatsApp
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" onClick={downloadStoredPdf} className="h-11 min-w-0" title="Bereits gespeicherte PDF direkt herunterladen">
            <FileDown className="h-4 w-4 mr-2" />Gespeicherte PDF
          </Button>
          <Button type="button" variant="secondary" onClick={openStoredPdf} className="h-11 min-w-0" title="Gespeicherte PDF im neuen Tab öffnen">
            <ExternalLink className="h-4 w-4 mr-2" />Im Browser öffnen
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <Button type="button" variant="secondary" onClick={emailStoredPdf} className="h-11 min-w-0" title="Gespeicherte PDF per E-Mail versenden (ohne Neuerstellung)">
            <MailPlus className="h-4 w-4 mr-2" />Gespeicherte PDF per E-Mail
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <PdfPreviewRenderer url={options.url} />
      </div>
    </div>
  );
}