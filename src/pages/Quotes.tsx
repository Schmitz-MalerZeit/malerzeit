import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { FolderOpen, Loader2, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ensureCustomerPriceOrientationText, ensureWhatsappPriceOrientationText, normalizePhoneForWa } from "@/lib/quoteText";
import { buildEmailMessageBody, buildWhatsappMessageBody } from "@/lib/messageText";
import { ensureWhatsappSignature } from "@/lib/messageTemplate";
import { PdfFlowSheet, type PdfFlowState } from "@/components/PdfFlowSheet";

const fmt = (n: number) => Number(n).toLocaleString("de-DE", { style: "currency", currency: "EUR" });


export default function Quotes() {
  const nav = useNavigate();
  const [items, setItems] = useState<any[] | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [pdfFlowOpen, setPdfFlowOpen] = useState(false);
  const [pdfFlow, setPdfFlow] = useState<PdfFlowState>({ phase: "idle" });
  const [lastQuote, setLastQuote] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deleteQuote = async (q: any) => {
    setDeleting(true);
    try {
      if (q.pdf_storage_path) {
        const { error: storageErr } = await supabase.storage
          .from("quote-pdfs")
          .remove([q.pdf_storage_path]);
        if (storageErr) console.warn("PDF-Datei konnte nicht entfernt werden:", storageErr);
      }
      const { error } = await supabase.from("quotes").delete().eq("id", q.id);
      if (error) throw error;
      setItems((prev) => (prev || []).filter((x) => x.id !== q.id));
      toast.success("Vorschlag gelöscht");
      setDeleteCandidate(null);
    } catch (e: any) {
      toast.error(e?.message || "Löschen fehlgeschlagen");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    supabase.from("quotes").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setItems(data || []));
    supabase.from("profiles").select("*").maybeSingle()
      .then(({ data }) => setProfile(data));
  }, []);


  const openSavedPdf = async (q: any) => {
    if (!q.pdf_storage_path) {
      toast.info("Für diesen älteren Vorschlag wurde noch keine PDF-Datei gespeichert.");
      return;
    }
    const fileName = q.pdf_filename || `Preisorientierung_${new Date(q.created_at).toISOString().slice(0, 10)}.pdf`;
    const subject = `Unverbindliche Preisorientierung${q.customer_name ? " – " + q.customer_name : ""}`;
    const grossFormatted = q.gross_amount != null ? fmt(q.gross_amount) : undefined;
    const baseEmail = ensureCustomerPriceOrientationText(q.customer_text || "Anbei erhalten Sie unsere unverbindliche Preisorientierung.");
    const baseWa = ensureWhatsappSignature(
      ensureWhatsappPriceOrientationText(q.whatsapp_text || "Anbei unsere unverbindliche Preisorientierung/Schätzung."),
      {
        companyName: profile?.company_name || "",
        signatureName: profile?.signatory_name || profile?.contact_person || profile?.company_name || "",
      },
    );
    const emailBody = buildEmailMessageBody(baseEmail, { grossFormatted });
    const whatsappText = buildWhatsappMessageBody(baseWa, { grossFormatted });
    const whatsappPhone = normalizePhoneForWa(q.customer_phone || "");

    setLastQuote(q);
    setPdfFlow({
      phase: "uploading",
      step: "Sicheren Link erstellen …",
      progress: 40,
      fileName, subject, emailBody, whatsappText, whatsappPhone,
    });
    setPdfFlowOpen(true);
    setOpeningId(q.id);
    try {
      const { data, error } = await supabase.storage
        .from("quote-pdfs")
        .createSignedUrl(q.pdf_storage_path, 60 * 60);
      if (error || !data?.signedUrl) throw error || new Error("PDF konnte nicht geöffnet werden");
      setPdfFlow((prev) => ({
        ...prev,
        step: "PDF-Datei laden …",
        progress: 75,
      }));
      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error(`PDF-Datei konnte nicht geladen werden (${response.status})`);
      const pdfBlob = await response.blob();
      setPdfFlow({
        phase: "ready",
        url: data.signedUrl,
        fileName, subject, emailBody, whatsappText, whatsappPhone, pdfBlob,
      });
    } catch (e: any) {
      setPdfFlow((prev) => ({
        ...prev,
        phase: "error",
        errorMessage: e?.message || "PDF konnte nicht geöffnet werden",
        errorDetail: typeof e?.stack === "string" ? e.stack.split("\n").slice(0, 8).join("\n") : String(e),
      }));
    } finally {
      setOpeningId(null);
    }
  };


  return (
    <AppShell title="Gespeicherte Vorschläge">
      {items === null && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {items && items.length === 0 && (
        <div className="text-center py-16">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Noch keine Vorschläge gespeichert.</p>
        </div>
      )}
      {items && items.length > 0 && (
        <div className="space-y-3">
          {items.map((q) => (
            <div key={q.id} className="rounded-2xl bg-card border border-border p-4 shadow-soft">
              <div className="flex justify-between items-start gap-3 mb-2">
                <div className="text-xs text-muted-foreground">
                  {new Date(q.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
                </div>
                <div className="text-base font-bold text-primary">{fmt(q.gross_amount)}</div>
              </div>
              <p className="text-sm text-foreground line-clamp-2">{q.description}</p>
              {Array.isArray(q.line_items) && q.line_items.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">{q.line_items.length} Leistungspositionen</p>
              )}
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <Button
                  type="button"
                  variant={q.pdf_storage_path ? "outline" : "secondary"}
                  onClick={() => openSavedPdf(q)}
                  disabled={openingId === q.id}
                  className="h-10 w-full"
                >
                  {openingId === q.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><Eye className="h-4 w-4 mr-2" /> {q.pdf_storage_path ? "PDF öffnen" : "Noch kein PDF gespeichert"}</>}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteCandidate(q)}
                  className="h-10 w-10 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  aria-label="Vorschlag löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteCandidate} onOpenChange={(o) => { if (!o && !deleting) setDeleteCandidate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorschlag wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate?.customer_name
                ? `„${deleteCandidate.customer_name}" wird unwiderruflich gelöscht`
                : "Dieser Vorschlag wird unwiderruflich gelöscht"}
              {deleteCandidate?.pdf_storage_path ? " – inklusive der gespeicherten PDF-Datei." : "."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (deleteCandidate) void deleteQuote(deleteCandidate); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ja, löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PdfFlowSheet
        open={pdfFlowOpen}
        state={pdfFlow}
        onOpenChange={(o) => {
          setPdfFlowOpen(o);
          if (!o && pdfFlow.phase === "error") setPdfFlow({ phase: "idle" });
        }}
        onAfterShareAction={() => {
          setPdfFlowOpen(false);
          setPdfFlow({ phase: "idle" });
        }}
        onRetry={() => { if (lastQuote) void openSavedPdf(lastQuote); }}
      />
    </AppShell>
  );
}
