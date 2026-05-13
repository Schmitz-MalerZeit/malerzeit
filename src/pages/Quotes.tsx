import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { FolderOpen, Loader2, Eye, Trash2, StickyNote, Save, Search, X, Pencil, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { useTr, currentLocale } from "@/lib/tr";
import { FirstVisitTip } from "@/components/FirstVisitTip";

const fmt = (n: number) => Number(n).toLocaleString(currentLocale(), { style: "currency", currency: "EUR" });


export default function Quotes() {
  const tr = useTr();
  const nav = useNavigate();
  const [items, setItems] = useState<any[] | null>(null);
  const [search, setSearch] = useState("");
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
        if (storageErr) console.warn(tr("PDF-Datei konnte nicht entfernt werden:", "PDF file could not be removed:"), storageErr);
      }
      const { error } = await supabase.from("quotes").delete().eq("id", q.id);
      if (error) throw error;
      setItems((prev) => (prev || []).filter((x) => x.id !== q.id));
      toast.success(tr("Vorschlag gelöscht", "Quote deleted"));
      setDeleteCandidate(null);
    } catch (e: any) {
      toast.error(e?.message || tr("Löschen fehlgeschlagen", "Delete failed"));
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
      toast.success(tr("Notiz gespeichert", "Note saved"));
      setNotesQuote(null);
    } catch (e: any) {
      toast.error(e?.message || tr("Speichern fehlgeschlagen", "Save failed"));
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


  const reopenInResult = (q: any, asNewVersion = false) => {
    const reconstructed = {
      savedQuoteId: asNewVersion ? null : q.id,
      description: q.description || "",
      customer: {
        name: q.customer_name || "",
        address: q.customer_address || "",
        postal_code: q.customer_postal_code || "",
        city: q.customer_city || "",
        phone: q.customer_phone || "",
        email: q.customer_email || "",
        project_label: q.project_label || "",
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
        estimated_labor_cost: Number(q.estimated_labor_cost) || 0,
        pricing: {
          net_amount: Number(q.net_amount) || 0,
          vat_amount: Number(q.vat_amount) || 0,
          gross_amount: Number(q.gross_amount) || 0,
          vat_rate: Number(q.vat_rate) || 19,
          labor_cost: Number(q.estimated_labor_cost) || 0,
          material_cost: Number(q.material_cost) || 0,
        },
        surcharge: { mode: "percent", value: 0 },
      },
      pdf_storage_path: asNewVersion ? null : (q.pdf_storage_path || null),
      pdf_filename: asNewVersion ? null : (q.pdf_filename || null),
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
    const fileName = q.pdf_filename || `${tr("Preisorientierung", "PriceEstimate")}_${new Date(q.created_at).toISOString().slice(0, 10)}.pdf`;
    const subject = `${tr("Unverbindliche Preisorientierung", "Non-binding price estimate")}${q.customer_name ? " – " + q.customer_name : ""}`;
    const grossFormatted = q.gross_amount != null ? fmt(q.gross_amount) : undefined;
    const baseEmail = ensureCustomerPriceOrientationText(q.customer_text || tr("Anbei erhalten Sie unsere unverbindliche Preisorientierung.", "Please find attached our non-binding price estimate."));
    const baseWa = ensureWhatsappSignature(
      ensureWhatsappPriceOrientationText(q.whatsapp_text || tr("Anbei unsere unverbindliche Preisorientierung/Schätzung.", "Here's our non-binding price estimate.")),
      {
        companyName: profile?.company_name || "",
        signatureName: profile?.signatory_name || profile?.contact_person || profile?.company_name || "",
      },
    );
    const projectLabel = q.project_label || "";
    const emailBody = buildEmailMessageBody(baseEmail, { grossFormatted, projectLabel });
    const whatsappText = waAllowed ? buildWhatsappMessageBody(baseWa, { grossFormatted, projectLabel }) : "";
    const whatsappPhone = waAllowed ? normalizePhoneForWa(q.customer_phone || "") : null;

    setLastQuote(q);
    setPdfFlow({
      phase: "uploading",
      step: tr("Sicheren Link erstellen …", "Creating secure link…"),
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
        console.warn(tr("Konnte verwaisten PDF-Pfad nicht bereinigen:", "Could not clean orphaned PDF path:"), cleanupErr);
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
          toast.info(tr("Für diesen Vorschlag ist keine PDF-Datei mehr vorhanden.", "No PDF file is available for this quote anymore."), {
            description: tr("Bitte erstelle den Vorschlag bei Bedarf neu.", "Please recreate the quote if needed."),
          });
          return;
        }
        throw error || new Error(tr("PDF konnte nicht geöffnet werden", "PDF could not be opened"));
      }

      setPdfFlow((prev) => ({
        ...prev,
        step: tr("PDF-Datei laden …", "Loading PDF file…"),
        progress: 75,
      }));
      const response = await fetch(data.signedUrl);
      if (!response.ok) {
        if (isMissingObjectError(null, response.status)) {
          await markPdfMissingInDb();
          setPdfFlowOpen(false);
          setPdfFlow({ phase: "idle" });
          toast.info(tr("Für diesen Vorschlag ist keine PDF-Datei mehr vorhanden.", "No PDF file is available for this quote anymore."), {
            description: tr("Bitte erstelle den Vorschlag bei Bedarf neu.", "Please recreate the quote if needed."),
          });
          return;
        }
        throw new Error(tr(`PDF-Datei konnte nicht geladen werden (${response.status})`, `PDF file could not be loaded (${response.status})`));
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
        errorMessage: e?.message || tr("PDF konnte nicht geöffnet werden", "PDF could not be opened"),
        errorDetail: typeof e?.stack === "string" ? e.stack.split("\n").slice(0, 8).join("\n") : String(e),
      }));
    } finally {
      setOpeningId(null);
    }
  };


  // Intelligente Suche: alle Tokens (Leerzeichen-getrennt) müssen irgendwo
  // im Vorschlag vorkommen — Name, Adresse, PLZ, Stadt, Datum, Beschreibung,
  // Leistungen, Sektionen, Notizen, Kundentexte. Diakritika werden ignoriert.
  const norm = (s: string) =>
    (s || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const buildHaystack = (q: any): string => {
    const parts: string[] = [
      q.customer_name, q.customer_address, q.customer_postal_code, q.customer_city,
      q.customer_phone, q.customer_email, q.description, q.internal_notes,
      q.customer_text, q.whatsapp_text,
      Array.isArray(q.line_items) ? q.line_items.join(" ") : "",
      Array.isArray(q.sections)
        ? q.sections.map((s: any) =>
            [s?.title, Array.isArray(s?.items) ? s.items.join(" ") : ""].join(" "),
          ).join(" ")
        : "",
    ];
    if (q.created_at) {
      const d = new Date(q.created_at);
      parts.push(
        d.toLocaleDateString(currentLocale(), { day: "2-digit", month: "long", year: "numeric" }),
        d.toLocaleDateString(currentLocale()),
        d.toISOString().slice(0, 10),
        String(d.getFullYear()),
      );
    }
    if (q.gross_amount != null) parts.push(String(q.gross_amount), fmt(q.gross_amount));
    return norm(parts.filter(Boolean).join(" "));
  };

  const tokens = norm(search).split(/\s+/).filter(Boolean);
  const filtered = (items || []).filter((q) => {
    if (tokens.length === 0) return true;
    const hay = buildHaystack(q);
    return tokens.every((t) => hay.includes(t));
  });

  return (
    <AppShell title={tr("Gespeicherte Vorschläge", "Saved quotes")}>
      <FirstVisitTip
        storageKey="quotes"
        title={tr("Tipps zu gespeicherten Vorschlägen", "Tips for saved quotes")}
      >
        <p>{tr(
          "Tippe auf einen Vorschlag, um ihn anzusehen, zu bearbeiten oder als zweite Variante neu zu kalkulieren.",
          "Tap a quote to view, edit or recalculate it as a second version.",
        )}</p>
        <p>{tr(
          "Über die Suche oben findest du Vorschläge schnell nach Kunde oder Bauvorhaben.",
          "Use the search at the top to quickly find quotes by customer or project.",
        )}</p>
        <p>{tr(
          "Du kannst aus jedem gespeicherten Vorschlag erneut ein PDF erstellen und es per WhatsApp oder E-Mail senden.",
          "From every saved quote you can create a fresh PDF and send it via WhatsApp or email.",
        )}</p>
      </FirstVisitTip>
      {items === null && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {items && items.length === 0 && (
        <div className="text-center py-16">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{tr("Noch keine Vorschläge gespeichert.", "No quotes saved yet.")}</p>
        </div>
      )}
      {items && items.length > 0 && (
        <>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr("Suchen: Name, Adresse, PLZ, Stadt, Datum, Leistung …", "Search: name, address, postcode, city, date, service…")}
            className="pl-9 pr-9 h-11"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
              aria-label={tr("Suche zurücksetzen", "Reset search")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            {tr(`Keine Vorschläge passen zu „${search}".`, `No quotes match "${search}".`)}
          </div>
        ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <div key={q.id} className="rounded-2xl bg-card border border-border p-4 shadow-soft">
              <button
                type="button"
                onClick={() => reopenInResult(q, false)}
                className="w-full text-left -m-1 p-1 rounded-lg hover:bg-accent/40 transition-colors"
                aria-label={tr("Vorschlag bearbeiten", "Edit quote")}
              >
                {q.customer_name && (
                  <div className="text-sm font-semibold text-foreground mb-2 truncate">
                    {q.customer_name}
                  </div>
                )}
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div className="text-xs text-muted-foreground">
                    {new Date(q.created_at).toLocaleDateString(currentLocale(), { day: "2-digit", month: "long", year: "numeric" })}
                  </div>
                  <div className="text-base font-bold text-primary">{fmt(q.gross_amount)}</div>
                </div>
                {q.project_label && (
                  <p className="text-xs text-muted-foreground mb-1 truncate">📍 {q.project_label}</p>
                )}
                <p className="text-sm text-foreground line-clamp-2">{q.description}</p>
                {Array.isArray(q.line_items) && q.line_items.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">{q.line_items.length} {tr("Leistungspositionen", "line items")}</p>
                )}
                {q.internal_notes && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">
                    📝 {q.internal_notes}
                  </p>
                )}
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={q.pdf_storage_path ? "outline" : "secondary"}
                  onClick={() => openSavedPdf(q)}
                  disabled={openingId === q.id}
                  className="h-10"
                >
                  {openingId === q.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><Eye className="h-4 w-4 mr-2" /> {q.pdf_storage_path ? "PDF" : tr("PDF erstellen", "Create PDF")}</>}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => reopenInResult(q, true)}
                  className="h-10"
                  aria-label={tr("Neue Version erstellen", "Create new version")}
                >
                  <Copy className="h-4 w-4 mr-2" /> {tr("Neue Version", "New version")}
                </Button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => reopenInResult(q, false)}
                  className="h-9 text-xs"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> {tr("Bearbeiten", "Edit")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openNotes(q)}
                  className={`h-9 text-xs ${q.internal_notes ? "text-primary border-primary/40" : ""}`}
                >
                  <StickyNote className="h-3.5 w-3.5 mr-1.5" /> {tr("Notiz", "Note")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteCandidate(q)}
                  className="h-9 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> {tr("Löschen", "Delete")}
                </Button>
              </div>
            </div>
          ))}
        </div>
        )}
        </>
      )}

      <AlertDialog open={!!deleteCandidate} onOpenChange={(o) => { if (!o && !deleting) setDeleteCandidate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("Vorschlag wirklich löschen?", "Really delete this quote?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate?.customer_name
                ? tr(`„${deleteCandidate.customer_name}" wird unwiderruflich gelöscht`, `"${deleteCandidate.customer_name}" will be deleted permanently`)
                : tr("Dieser Vorschlag wird unwiderruflich gelöscht", "This quote will be deleted permanently")}
              {deleteCandidate?.pdf_storage_path ? tr(" – inklusive der gespeicherten PDF-Datei.", " — including the stored PDF file.") : "."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tr("Abbrechen", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (deleteCandidate) void deleteQuote(deleteCandidate); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Ja, löschen", "Yes, delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!notesQuote} onOpenChange={(o) => { if (!o && !notesSaving) setNotesQuote(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>{tr("Interne Notizen", "Internal notes")}</SheetTitle>
            <SheetDescription>
              {notesQuote?.customer_name || tr("Vorschlag", "Quote")} · {tr("nur intern sichtbar, erscheint nicht im PDF oder in Nachrichten.", "internal only — does not appear in PDF or messages.")}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 py-4">
            <Textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              placeholder={tr("Hinweise zum Kunden, gerechnete Aufschläge, Sondervereinbarungen …", "Notes about the customer, applied surcharges, special agreements…")}
              className="min-h-[260px] resize-y text-sm"
            />
          </div>
          <SheetFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setNotesQuote(null)} disabled={notesSaving}>
              {tr("Abbrechen", "Cancel")}
            </Button>
            <Button onClick={saveNotes} disabled={notesSaving}>
              {notesSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> {tr("Speichern", "Save")}</>}
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
