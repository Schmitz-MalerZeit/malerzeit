import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { FolderOpen, Loader2, Eye, Trash2, StickyNote, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
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
import { useSubscription } from "@/hooks/useSubscription";
import { canSendViaWhatsapp, getTier } from "@/lib/planFeatures";

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
  const [notesQuote, setNotesQuote] = useState<any | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const subState = useSubscription();
  const waAllowed = canSendViaWhatsapp(getTier(subState));

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

  const openNotes = (q: any) => {
    setNotesQuote(q);
    setNotesValue(q.internal_notes || "");
  };

  const saveNotes = async () => {
    if (!notesQuote) return;
    setNotesSaving(true);
    try {
      const { error } = await supabase
        .from("quotes")
        .update({ internal_notes: notesValue || null })
        .eq("id", notesQuote.id);
      if (error) throw error;
      setItems((prev) => (prev || []).map((x) =>
        x.id === notesQuote.id ? { ...x, internal_notes: notesValue || null } : x,
      ));
      toast.success("Notiz gespeichert");
      setNotesQuote(null);
    } catch (e: any) {
      toast.error(e?.message || "Speichern fehlgeschlagen");
    } finally {
      setNotesSaving(false);
    }
  };

  useEffect(() => {
    supabase.from("quotes").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setItems(data || []));
    supabase.from("profiles").select("*").maybeSingle()
      .then(({ data }) => setProfile(data));
  }, []);


  const reopenInResult = (q: any) => {
    const reconstructed = {
      savedQuoteId: q.id,
      description: q.description || "",
      customer: {
        name: q.customer_name || "",
        address: q.customer_address || "",
        postal_code: q.customer_postal_code || "",
        city: q.customer_city || "",
        phone: q.customer_phone || "",
        email: q.customer_email || "",
      },
      answers: {},
      ai: {
        line_items: Array.isArray(q.line_items) ? q.line_items : [],
        sections: Array.isArray(q.sections) ? q.sections : [],
        customer_text: q.customer_text || "",
        whatsapp_text: q.whatsapp_text || "",
        whatsapp_edited: !!q.whatsapp_text,
        estimated_hours: Number(q.estimated_hours) || 0,
        estimated_material_cost: Number(q.estimated_material) || 0,
        estimated_labor_cost: 0,
        pricing: {
          net_amount: Number(q.net_amount) || 0,
          vat_amount: Number(q.vat_amount) || 0,
          gross_amount: Number(q.gross_amount) || 0,
          vat_rate: Number(q.vat_rate) || 19,
          labor_cost: 0,
          material_cost: 0,
        },
        surcharge: { mode: "percent", value: 0 },
      },
      pdf_storage_path: q.pdf_storage_path || null,
      pdf_filename: q.pdf_filename || null,
    };
    localStorage.setItem("currentQuote", JSON.stringify(reconstructed));
    sessionStorage.removeItem("currentQuotePdf");
    nav("/quote/result");
  };

  const openSavedPdf = async (q: any) => {
    if (!q.pdf_storage_path) {
      reopenInResult(q);
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
    const whatsappText = waAllowed ? buildWhatsappMessageBody(baseWa, { grossFormatted }) : "";
    const whatsappPhone = waAllowed ? normalizePhoneForWa(q.customer_phone || "") : null;

    setLastQuote(q);
    setPdfFlow({
      phase: "uploading",
      step: "Sicheren Link erstellen …",
      progress: 40,
      fileName, subject, emailBody, whatsappText, whatsappPhone,
    });
    setPdfFlowOpen(true);
    setOpeningId(q.id);

    const isMissingObjectError = (err: unknown, status?: number) => {
      if (status === 400 || status === 404) return true;
      const msg = (err as any)?.message?.toString().toLowerCase() || "";
      return msg.includes("not found") || msg.includes("object not found") || msg.includes("no such");
    };

    const markPdfMissingInDb = async () => {
      try {
        await supabase
          .from("quotes")
          .update({ pdf_storage_path: null, pdf_filename: null })
          .eq("id", q.id);
      } catch (cleanupErr) {
        console.warn("Konnte verwaisten PDF-Pfad nicht bereinigen:", cleanupErr);
      }
      setItems((prev) => (prev || []).map((x) =>
        x.id === q.id ? { ...x, pdf_storage_path: null, pdf_filename: null } : x,
      ));
    };

    try {
      const { data, error } = await supabase.storage
        .from("quote-pdfs")
        .createSignedUrl(q.pdf_storage_path, 60 * 60);

      if (error || !data?.signedUrl) {
        if (isMissingObjectError(error)) {
          await markPdfMissingInDb();
          setPdfFlowOpen(false);
          setPdfFlow({ phase: "idle" });
          toast.info("Für diesen Vorschlag ist keine PDF-Datei mehr vorhanden.", {
            description: "Bitte erstelle den Vorschlag bei Bedarf neu.",
          });
          return;
        }
        throw error || new Error("PDF konnte nicht geöffnet werden");
      }

      setPdfFlow((prev) => ({
        ...prev,
        step: "PDF-Datei laden …",
        progress: 75,
      }));
      const response = await fetch(data.signedUrl);
      if (!response.ok) {
        if (isMissingObjectError(null, response.status)) {
          await markPdfMissingInDb();
          setPdfFlowOpen(false);
          setPdfFlow({ phase: "idle" });
          toast.info("Für diesen Vorschlag ist keine PDF-Datei mehr vorhanden.", {
            description: "Bitte erstelle den Vorschlag bei Bedarf neu.",
          });
          return;
        }
        throw new Error(`PDF-Datei konnte nicht geladen werden (${response.status})`);
      }
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
              {q.customer_name && (
                <div className="text-sm font-semibold text-foreground mb-2 truncate">
                  {q.customer_name}
                </div>
              )}
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
              {q.internal_notes && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">
                  📝 {q.internal_notes}
                </p>
              )}
              <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
                <Button
                  type="button"
                  variant={q.pdf_storage_path ? "outline" : "secondary"}
                  onClick={() => openSavedPdf(q)}
                  disabled={openingId === q.id}
                  className="h-10 w-full"
                >
                  {openingId === q.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><Eye className="h-4 w-4 mr-2" /> {q.pdf_storage_path ? "PDF öffnen" : "Öffnen & PDF erstellen"}</>}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openNotes(q)}
                  className={`h-10 w-10 p-0 ${q.internal_notes ? "text-primary border-primary/40" : ""}`}
                  aria-label="Notizen"
                >
                  <StickyNote className="h-4 w-4" />
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

      <Sheet open={!!notesQuote} onOpenChange={(o) => { if (!o && !notesSaving) setNotesQuote(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>Interne Notizen</SheetTitle>
            <SheetDescription>
              {notesQuote?.customer_name || "Vorschlag"} · nur intern sichtbar, erscheint nicht im PDF oder in Nachrichten.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 py-4">
            <Textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              placeholder="Hinweise zum Kunden, gerechnete Aufschläge, Sondervereinbarungen …"
              className="min-h-[260px] resize-y text-sm"
            />
          </div>
          <SheetFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setNotesQuote(null)} disabled={notesSaving}>
              Abbrechen
            </Button>
            <Button onClick={saveNotes} disabled={notesSaving}>
              {notesSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Speichern</>}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
