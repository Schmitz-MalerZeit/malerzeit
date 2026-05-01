import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, FileDown, Save, Loader2, Check, RotateCw, Eye, Lock, Sparkles, Pencil, Plus, Trash2, Mail, MessageCircle, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildQuotePDF, urlToDataUrl, prepareLogoForPdf } from "@/lib/pdf";
import { useSubscription } from "@/hooks/useSubscription";
import { canDownloadPdf, canUseLogoInPdf, getTier } from "@/lib/planFeatures";
import { PdfPreviewRenderer } from "@/components/PdfPreviewRenderer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const fmt = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export default function QuoteResult() {
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [pdfQuotaConsumed, setPdfQuotaConsumed] = useState(false);
  // Bestätigungs-Dialog vor PDF-Erstellung (zählt aufs Kontingent).
  const [confirmAction, setConfirmAction] = useState<null | "preview" | "download">(null);
  // Dialog nach erfolgreichem PDF-Download: Versand per E-Mail / WhatsApp anbieten.
  const [shareOpen, setShareOpen] = useState(false);
  const [lastFilename, setLastFilename] = useState<string>("");
  const [lastSavedPdfPath, setLastSavedPdfPath] = useState<string | null>(null);
  // Inline-PDF-Vorschau (Dialog mit iframe) – funktioniert ohne Popup-Blocker.
  const [previewOpen, setPreviewOpen] = useState(false);
  const subState = useSubscription();
  const tier = getTier(subState);
  const pdfAllowed = canDownloadPdf(tier);
  const logoAllowed = canUseLogoInPdf(tier);

  // Revoke blob URL on unmount (only the in-memory URL; the base64 cache stays in sessionStorage)
  useEffect(() => {
    return () => { if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl); };
  }, [previewBlobUrl]);

  useEffect(() => {
    const raw = sessionStorage.getItem("currentQuote");
    if (!raw) { nav("/quote/new"); return; }
    setData(JSON.parse(raw));
    supabase.from("profiles").select("*").maybeSingle().then(({ data }) => setProfile(data));
    supabase.from("user_settings").select("*").maybeSingle().then(({ data }) => setSettings(data));

    // Restore previously generated PDF from sessionStorage if available
    const cachedB64 = sessionStorage.getItem("currentQuotePdf");
    if (cachedB64) {
      try {
        const bin = atob(cachedB64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setPreviewBlob(blob);
        setPreviewBlobUrl(url);
        setPdfQuotaConsumed(true);
      } catch (e) {
        console.warn("could not restore cached PDF", e);
        sessionStorage.removeItem("currentQuotePdf");
      }
    }
  }, [nav]);

  // Persist edits back to sessionStorage and invalidate any cached PDF so the
  // next preview/download uses the new texts.
  const persistEdits = (next: any) => {
    setData(next);
    sessionStorage.setItem("currentQuote", JSON.stringify(next));
    sessionStorage.removeItem("currentQuotePdf");
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setPreviewBlob(null);
    setPdfQuotaConsumed(false);
  };

  const updateLineItem = (index: number, value: string) => {
    if (!data) return;
    const items = [...data.ai.line_items];
    items[index] = value;
    persistEdits({ ...data, ai: { ...data.ai, line_items: items } });
  };
  const removeLineItem = (index: number) => {
    if (!data) return;
    const items = data.ai.line_items.filter((_: string, i: number) => i !== index);
    persistEdits({ ...data, ai: { ...data.ai, line_items: items } });
  };
  const addLineItem = () => {
    if (!data) return;
    const items = [...data.ai.line_items, ""];
    persistEdits({ ...data, ai: { ...data.ai, line_items: items } });
  };
  const updateCustomerText = (value: string) => {
    if (!data) return;
    persistEdits({ ...data, ai: { ...data.ai, customer_text: value } });
  };
  const updateWhatsappText = (value: string) => {
    if (!data) return;
    persistEdits({ ...data, ai: { ...data.ai, whatsapp_text: value, whatsapp_edited: true } });
  };

  if (!data) return null;
  const ai = data.ai;
  const p = ai.pricing;

  // Baue WhatsApp-Text deterministisch zusammen: Anrede mit Kundenname,
  // kurzer Umfang (Leistungen), Brutto-Preis, Schlusssatz, Grußformel mit
  // zeichnungsberechtigter Person. Wenn der Nutzer den Text manuell editiert
  // hat, wird der editierte Text beibehalten.
  const composeWhatsapp = (): string => {
    const customerName = (data.customer?.name || "").trim();
    const greeting = customerName ? `Hallo ${customerName},` : "Hallo,";
    const intro = "vielen Dank für deine Anfrage. Hier eine unverbindliche Preisorientierung für die geplanten Arbeiten:";
    const items = (ai.line_items || [])
      .filter((s: string) => s && s.trim())
      .map((s: string) => `• ${s.trim()}`)
      .join("\n");
    const price = `Gesamtpreis (brutto): ${fmt(p.gross_amount)}`;
    const closing = (settings?.closing_text || "Sofern sich diese Preisorientierung in deinem Rahmen bewegt, erstellen wir dir gerne ein verbindliches schriftliches Angebot.").trim();
    const sigName = (profile?.signatory_name || profile?.contact_person || profile?.company_name || "").trim();
    const signature = sigName ? `Viele Grüße\n${sigName}` : "Viele Grüße";
    return [greeting, "", intro, "", items, "", price, "", closing, "", signature]
      .filter((l) => l !== undefined)
      .join("\n");
  };

  const whatsappDisplay = ai.whatsapp_edited ? (ai.whatsapp_text || "") : composeWhatsapp();

  const copyText = async () => {
    await navigator.clipboard.writeText(ai.customer_text);
    toast.success("Kundentext kopiert");
  };
  const copyWA = async () => {
    await navigator.clipboard.writeText(whatsappDisplay);
    toast.success("WhatsApp-Text kopiert");
  };

  const buildPDF = async () => {
    let logoDataUrl: string | undefined;
    let logoSize: { width: number; height: number } | undefined;
    if (logoAllowed && profile?.logo_url) {
      // urlToDataUrl: Storage-URL → Data-URL (für jspdf einbettbar).
      // prepareLogoForPdf: konvertiert SVG/unsupported → PNG via Canvas und liest
      // die natürlichen Maße aus. Bei Fehlern bleibt logoDataUrl undefined und
      // der PDF-Renderer übernimmt das Initial-Fallback automatisch.
      const raw = await urlToDataUrl(profile.logo_url);
      if (raw) {
        const prepared = await prepareLogoForPdf(raw);
        if (prepared) {
          logoDataUrl = prepared.dataUrl;
          logoSize = { width: prepared.width, height: prepared.height };
        } else {
          // Bewusst die Roh-Data-URL übergeben – wenn sie ein Format hat, das
          // jspdf doch akzeptiert, klappt's; sonst greift der Initial-Fallback.
          logoDataUrl = raw;
        }
      }
    }
    return buildQuotePDF({
      company: {
        name: profile?.company_name,
        contact: profile?.contact_person,
        address: profile?.address,
        addressLine2: profile?.address_line2,
        postalCode: profile?.postal_code,
        city: profile?.city,
        phone: profile?.phone,
        email: profile?.email,
        website: profile?.website,
        logoDataUrl,
        logoNaturalWidth: logoSize?.width,
        logoNaturalHeight: logoSize?.height,
        primaryColor: logoAllowed ? profile?.logo_primary_color : undefined,
        secondaryColor: logoAllowed ? profile?.logo_secondary_color : undefined,
      },
      customer: data.customer ? {
        name: data.customer.name,
        address: data.customer.address,
        postalCode: data.customer.postal_code,
        city: data.customer.city,
      } : undefined,
      date: new Date().toLocaleDateString("de-DE"),
      lineItems: ai.line_items,
      net: p.net_amount, vat: p.vat_amount, gross: p.gross_amount, vatRate: p.vat_rate,
      validityDays: settings?.quote_validity_days ?? 14,
      closingText: settings?.closing_text ?? "Sollte Ihnen unser Angebot zusagen, freuen wir uns über Ihre Auftragszusage.",
      signatureName: profile?.signatory_name || profile?.contact_person || profile?.company_name,
    });
  };

  const consumeQuota = async (): Promise<boolean> => {
    const { data, error } = await supabase.rpc("consume_pdf_quota");
    if (error) { toast.error("Limit-Prüfung fehlgeschlagen: " + error.message); return false; }
    const res = data as { ok: boolean; error?: string; limit?: number; used?: number; mode?: string };
    if (!res?.ok) {
      if (res?.error === "trial_exhausted") {
        toast.error(`Test-PDFs aufgebraucht (${res.used}/${res.limit}). Wähle einen Tarif, um weiter PDFs herunterzuladen.`, {
          action: { label: "Tarife", onClick: () => nav("/pricing") },
        });
      } else if (res?.error === "limit_reached") {
        toast.error(`Monatslimit erreicht (${res.used}/${res.limit}).`, {
          action: { label: "Upgrade", onClick: () => nav("/pricing") },
        });
      } else if (res?.error === "no_active_plan") {
        toast.error("Kein aktiver Tarif. Bitte wähle einen Plan.", {
          action: { label: "Tarife", onClick: () => nav("/pricing") },
        });
      } else {
        toast.error("PDF-Erstellung nicht erlaubt.");
      }
      return false;
    }
    return true;
  };

  const slugify = (input: string, maxLen = 50): string => {
    if (!input) return "";

    // 1) Pre-map common multi-character substitutions BEFORE diacritic stripping.
    //    German convention: ä→ae, ö→oe, ü→ue, ß→ss. Also handle Nordic/East-Euro letters
    //    that NFD doesn't split (æ, œ, ø, ð, þ, ł).
    const charMap: Record<string, string> = {
      "ä": "ae", "ö": "oe", "ü": "ue", "Ä": "Ae", "Ö": "Oe", "Ü": "Ue",
      "ß": "ss", "ẞ": "SS",
      "æ": "ae", "Æ": "Ae", "œ": "oe", "Œ": "Oe",
      "ø": "o",  "Ø": "O",  "ð": "d",  "Ð": "D",
      "þ": "th", "Þ": "Th", "ł": "l",  "Ł": "L",
      "ñ": "n",  "Ñ": "N",
    };
    let s = input.replace(/[äöüÄÖÜßẞæÆœŒøØðÐþÞłŁñÑ]/g, (c) => charMap[c] ?? c);

    // 2) Symbol/punctuation map — replace with words rather than dropping silently
    const symbolMap: Record<string, string> = {
      // logical / textual connectors
      "&": " und ", "+": " plus ", "=": " gleich ",
      "@": " at ", "#": " nr ",
      "%": " prozent ", "‰": " promille ",
      // currencies (incl. fullwidth and CJK variants)
      "€": " eur ", "$": " usd ", "£": " gbp ", "¥": " jpy ",
      "₽": " rub ", "₹": " inr ", "₩": " krw ", "¢": " cent ",
      "＄": " usd ", "￡": " gbp ", "￥": " jpy ", "￠": " cent ",
      // arrows / connectors → "zu"
      "→": " zu ", "⇒": " zu ", "➔": " zu ", "➜": " zu ", "➝": " zu ",
      "←": " zu ", "⇐": " zu ",
      "↔": " bis ", "⇔": " bis ",
      // dashes (en/em/figure/horizontal-bar/minus)
      "–": " ", "—": " ", "―": " ", "‒": " ", "−": " ",
      // path-like separators
      "/": " ", "\\": " ", "|": " ",
      // typographic quotes/apostrophes (drop, don't word-replace)
      "“": " ", "”": " ", "„": " ", "‟": " ",
      "‘": " ", "’": " ", "‚": " ", "‛": " ",
      "«": " ", "»": " ", "‹": " ", "›": " ",
      // bullets / middots / ellipsis
      "•": " ", "·": " ", "●": " ", "◦": " ", "…": " ",
    };
    // Build the regex from the map keys so we never drift out of sync.
    const symbolPattern = new RegExp(
      "[" + Object.keys(symbolMap).map((c) => c.replace(/[\\\]\-^]/g, "\\$&")).join("") + "]",
      "g",
    );
    s = s.replace(symbolPattern, (c) => symbolMap[c] ?? " ");

    // 3) Strip remaining diacritics (NFD splits e.g. é → e + ´, then we drop the mark)
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 4) Anything not ASCII letter/digit/space/dash/underscore becomes a space.
    //    This is what makes non-Latin scripts (CJK, Cyrillic, Arabic, …) collapse
    //    cleanly into separators rather than producing garbled output.
    s = s.replace(/[^A-Za-z0-9 _-]+/g, " ");

    // 5) Normalize whitespace and dashes → single underscore separator
    s = s.replace(/[-\s_]+/g, "_").replace(/^_+|_+$/g, "");

    if (!s) return "";

    // 6) Length cap on a word boundary (avoid mid-word truncation)
    if (s.length > maxLen) {
      const cut = s.slice(0, maxLen);
      const lastSep = cut.lastIndexOf("_");
      s = lastSep > maxLen * 0.5 ? cut.slice(0, lastSep) : cut;
      s = s.replace(/_+$/g, "");
    }

    return s;
  };

  // German + numeric/unit stop words that don't help identify a project
  const STOP_WORDS = new Set([
    "und", "oder", "mit", "ohne", "im", "in", "am", "an", "auf", "der", "die", "das",
    "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines",
    "ca", "circa", "bis", "von", "zu", "zum", "zur", "als", "fuer", "für",
    "std", "stunden", "stunde", "stk", "stueck", "stück", "qm", "m2", "m",
    "lehrjahr", "lehrling", "geselle", "junggeselle", "azubi", "helfer", "meister",
    "projektleiter", "malermeister", "personal", "material", "materialaufwand",
    "leistungsumfang", "arbeiten", "eingesetztes", "geschaetzter", "geschätzter",
    "geschaetzte", "geschätzte", "vor", "aufschlag", "netto", "brutto",
    "bewohnt", "innen", "aussen", "außen", "normaler", "zugang",
    "kleinmaterial", "spachtel", "vlies", "farbe",
  ]);

  // Pull the "Arbeiten / Leistungsumfang" block out of the structured description
  const extractWorkBlock = (raw: string): string => {
    if (!raw) return "";
    // Match block "1) Arbeiten ..." until next "2)" or end
    const m = raw.match(/(?:^|\n)\s*1\)?\s*Arbeiten[^\n]*\n([\s\S]*?)(?:\n\s*2\)|\Z)/i);
    return m ? m[1] : raw;
  };

  // Pick the most "interesting" tokens from a chunk of text
  const topKeywords = (text: string, maxWords = 5): string => {
    const tokens = text
      .replace(/[€%]/g, " ")
      .split(/[^a-zA-ZäöüÄÖÜß0-9-]+/)
      .map((w) => w.trim())
      .filter((w) =>
        w.length >= 4 &&
        !/^\d+$/.test(w) &&                       // skip pure numbers (12, 25, etc.)
        !STOP_WORDS.has(w.toLowerCase()) &&
        !/^\d+(st|stk|qm|m2|m|h|std)$/i.test(w),  // skip "12std", "25qm", etc.
      );

    // Deduplicate while preserving first-seen order (= order in description)
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const t of tokens) {
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(t);
      if (unique.length >= maxWords) break;
    }
    return unique.join(" ");
  };

  const filename = () => {
    const date = new Date().toISOString().slice(0, 10);

    const customerSlug = slugify(data.customer?.name || "");
    if (customerSlug) return `Preisorientierung_${customerSlug}_${date}.pdf`;

    // 1) Prefer the first AI-curated line item (already concise & relevant)
    const firstLine: string | undefined = ai?.line_items?.[0];
    if (firstLine) {
      const lineSlug = slugify(topKeywords(firstLine, 5));
      if (lineSlug) return `Preisorientierung_${lineSlug}_${date}.pdf`;
    }

    // 2) Fallback: keywords from the "Arbeiten" block of the description
    const workBlock = extractWorkBlock(data.description || "");
    const workSlug = slugify(topKeywords(workBlock, 5));
    if (workSlug) return `Preisorientierung_${workSlug}_${date}.pdf`;

    // 3) Last resort: first ~6 words of the raw description
    const firstWords = (data.description || "").split(/\s+/).slice(0, 6).join(" ");
    const descSlug = slugify(firstWords);
    if (descSlug) return `Preisorientierung_${descSlug}_${date}.pdf`;

    return `Preisorientierung_${date}.pdf`;
  };

  // Detects mobile browsers where the standard `<a download>` trick is unreliable
  // (notably iOS Safari, where it silently navigates instead of saving).
  const isMobileBrowser = (): boolean => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
    const isAndroid = /Android/i.test(ua);
    return isIOS || isAndroid;
  };

  // Try to share the PDF as a real file via the native Share Sheet (iOS/Android).
  // Returns true on success, false if the API is unavailable or the user cancels.
  const tryNativeShare = async (blob: Blob, fileName: string): Promise<boolean> => {
    try {
      const nav: any = navigator;
      if (typeof nav.canShare !== "function") return false;
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (!nav.canShare({ files: [file] })) return false;
      await nav.share({ files: [file], title: fileName });
      return true;
    } catch (e: any) {
      // AbortError = user cancelled; treat as "handled" so we don't fall back
      if (e?.name === "AbortError") return true;
      console.warn("native share failed", e);
      return false;
    }
  };

  const triggerBlobDownload = (url: string, fileName = filename()) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    a.target = "_self";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Mobile-safe "save the PDF" flow:
  // 1) Try native share (iOS/Android can save to Files / Drive directly)
  // 2) Otherwise, open the PDF in a new tab so the OS preview offers "Save to Files"
  // 3) On desktop, the standard download attribute works fine.
  const savePdfBlob = async (blob: Blob, url: string, fileName: string): Promise<void> => {
    if (isMobileBrowser()) {
      const shared = await tryNativeShare(blob, fileName);
      if (shared) return;
      // Fallback: open in new tab. iOS Safari then shows the PDF with a share button.
      const win = window.open(url, "_blank");
      if (!win) {
        // Popup blocked → last-resort same-tab navigation
        window.location.href = url;
      }
      return;
    }
    triggerBlobDownload(url, fileName);
  };

  const openPendingPreviewWindow = () => {
    const win = window.open("", "_blank");
    if (!win) return null;
    win.document.title = "PDF-Vorschau";
    win.document.body.innerHTML = "<p style='font-family:system-ui,sans-serif;padding:24px'>PDF wird erstellt …</p>";
    return win;
  };

  // Cache the freshly built PDF in sessionStorage so it survives a reload
  // (avoids re-building and re-consuming quota).
  const cachePdfInSession = async (blob: Blob) => {
    try {
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      // Chunked to avoid call-stack overflows on large PDFs
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      sessionStorage.setItem("currentQuotePdf", btoa(bin));
    } catch (e) {
      // sessionStorage quota (~5MB) — caching is best-effort, no user-visible failure
      console.warn("could not cache PDF in session", e);
    }
  };

  const guardPdfAccess = (): boolean => {
    if (pdfAllowed) return true;
    toast.error("PDF-Download ist ab dem Profi-Tarif verfügbar.", {
      action: { label: "Tarife ansehen", onClick: () => nav("/pricing") },
    });
    return false;
  };

  const downloadPDF = async () => {
    if (!guardPdfAccess()) return;
    setBusy(true);
    try {
      const fileName = filename();
      // Reuse the preview blob if it has already been built (no extra quota cost)
      if (previewBlob && previewBlobUrl) {
        if (!pdfQuotaConsumed) {
          const ok = await consumeQuota();
          if (!ok) return;
          setPdfQuotaConsumed(true);
        }
        await savePdfBlob(previewBlob, previewBlobUrl, fileName);
        setPreviewFailed(false);
        setLastFilename(fileName);
        // Share-Dialog erst nach dem Download öffnen, damit ein Modal-Overlay
        // den Browser-Download nicht abbricht (insb. iOS Safari).
        setTimeout(() => setShareOpen(true), 800);
        save(true); // automatisch speichern (still, ohne Toast)
        return;
      }
      const pdf = await buildPDF();                 // 1) build first (no cost if it fails)
      const ok = await consumeQuota();              // 2) atomically consume quota
      if (!ok) return;
      setPdfQuotaConsumed(true);
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      setPreviewBlob(blob);
      setPreviewBlobUrl(url);                       // make it reusable for preview / retry
      await cachePdfInSession(blob);                // persist across reloads
      await savePdfBlob(blob, url, fileName);
      setPreviewFailed(false);
      setLastFilename(fileName);
      // Share-Dialog erst nach dem Download öffnen, damit ein Modal-Overlay
      // den Browser-Download nicht abbricht (insb. iOS Safari).
      setTimeout(() => setShareOpen(true), 800);
      save(true); // automatisch speichern (still, ohne Toast)
    } catch (e: any) { toast.error(e.message || "PDF-Fehler"); }
    finally { setBusy(false); }
  };

  const openBlob = (url: string): boolean => {
    const win = window.open(url, "_blank");
    if (!win || win.closed || typeof win.closed === "undefined") {
      setPreviewFailed(true);
      toast.error("Vorschau konnte nicht geöffnet werden (evtl. Popup blockiert).", {
        action: { label: "Erneut", onClick: () => retryPreview() },
      });
      return false;
    }
    try { win.opener = null; } catch { /* noop */ }
    setPreviewFailed(false);
    return true;
  };

  const retryPreview = () => {
    previewPDF();
  };

  const previewPDF = async () => {
    if (!guardPdfAccess()) return;
    setBusy(true);
    try {
      // Vorschau ist KOSTENLOS (kein Quota-Verbrauch). Erst der Download
      // zählt aufs Kontingent.
      let url = previewBlobUrl;
      if (!url) {
        const pdf = await buildPDF();
        const blob = pdf.output("blob");
        url = URL.createObjectURL(blob);
        setPreviewBlob(blob);
        setPreviewBlobUrl(url);
      }
      // Inline-Vorschau im Dialog öffnen – kein Popup, kein neues Fenster.
      setPreviewOpen(true);
      setPreviewFailed(false);
    } catch (e: any) {
      setPreviewFailed(true);
      toast.error(e.message || "PDF-Fehler", {
        action: { label: "Erneut", onClick: () => retryPreview() },
      });
    }
    finally { setBusy(false); }
  };

  // Vom Vorschau-Dialog aus direkt herunterladen (verbraucht Quota).
  const downloadFromPreview = async () => {
    setPreviewOpen(false);
    // Kurz warten, damit der Dialog sauber schließt, bevor der Download startet.
    setTimeout(() => downloadPDF(), 150);
  };

  // Speichert den Vorschlag in der Datenbank. `silent=true` unterdrückt Toasts
  // und den Busy-Spinner – wird beim Auto-Speichern nach PDF-Erstellung genutzt.
  const save = async (silent = false) => {
    if (saved) return;
    if (!silent) setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("quotes").insert({
        user_id: u.user.id,
        description: data.description,
        line_items: ai.line_items,
        customer_text: ai.customer_text,
        whatsapp_text: ai.whatsapp_text,
        net_amount: p.net_amount,
        vat_amount: p.vat_amount,
        gross_amount: p.gross_amount,
        vat_rate: p.vat_rate,
        estimated_hours: ai.estimated_hours,
        estimated_material: ai.estimated_material_cost,
        customer_name: data.customer?.name || null,
        customer_address: data.customer?.address || null,
        customer_postal_code: data.customer?.postal_code || null,
        customer_city: data.customer?.city || null,
        customer_phone: data.customer?.phone || null,
        customer_email: data.customer?.email || null,
      });
      if (error) throw error;
      setSaved(true);
      if (!silent) toast.success("Vorschlag gespeichert");
    } catch (e: any) {
      if (!silent) toast.error(e.message);
      else console.warn("Auto-Speichern fehlgeschlagen:", e?.message);
    }
    finally { if (!silent) setBusy(false); }
  };

  const headerTitle = data.customer?.name?.trim() || "Preisorientierung";

  // Telefonnummer für WhatsApp normalisieren: nur Ziffern, führende 0 → 49.
  const normalizePhoneForWa = (raw: string): string | null => {
    if (!raw) return null;
    let digits = raw.replace(/[^\d+]/g, "");
    if (digits.startsWith("+")) digits = digits.slice(1);
    else if (digits.startsWith("00")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = "49" + digits.slice(1);
    return /^\d{8,15}$/.test(digits) ? digits : null;
  };

  const customerEmail = (data.customer?.email || "").trim();
  const customerPhone = (data.customer?.phone || "").trim();
  const waPhone = normalizePhoneForWa(customerPhone);

  const sendViaEmail = () => {
    const subject = `Unverbindliche Preisorientierung${data.customer?.name ? " – " + data.customer.name : ""}`;
    const body = (ai.customer_text || "") + (lastFilename ? `\n\n(PDF im Anhang: ${lastFilename} – bitte aus deinem Download-Ordner anhängen.)` : "");
    const to = encodeURIComponent(customerEmail);
    const params = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = `mailto:${to}?${params}`;
    setShareOpen(false);
  };

  const sendViaWhatsapp = () => {
    if (!waPhone) return;
    const text = whatsappDisplay + (lastFilename ? `\n\n📎 PDF im Anhang: ${lastFilename}\n(Bitte das PDF aus deinem Download-Ordner an diesen Chat anhängen.)` : "");
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setShareOpen(false);
  };


  return (
    <AppShell title={headerTitle}>
      <div className="space-y-5">
        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">Leistungen</h2>
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Pencil className="h-3 w-3" /> bearbeitbar
            </span>
          </div>
          <ul className="space-y-2">
            {ai.line_items.map((item: string, i: number) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="text-primary font-bold mt-2.5">•</span>
                <Textarea
                  value={item}
                  onChange={(e) => updateLineItem(i, e.target.value)}
                  rows={1}
                  className="flex-1 min-h-[40px] text-sm resize-y"
                />
                <button
                  type="button"
                  onClick={() => removeLineItem(i)}
                  className="mt-2 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Position entfernen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLineItem}
            className="mt-3 h-9"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Position hinzufügen
          </Button>
        </div>

        <div className="rounded-xl bg-secondary/50 border border-border p-4 text-xs text-muted-foreground leading-relaxed">
          Der ausgewiesene Preis berücksichtigt einen geschätzten Arbeitslohn sowie den voraussichtlichen Materialeinsatz auf Grundlage der angegebenen Informationen.
        </div>

        <div className="rounded-2xl gradient-primary text-primary-foreground p-5 shadow-elevated">
          <div className="flex justify-between text-sm mb-2"><span>Netto</span><span className="font-medium">{fmt(p.net_amount)}</span></div>
          <div className="flex justify-between text-sm mb-3"><span>MwSt. ({p.vat_rate}%)</span><span className="font-medium">{fmt(p.vat_amount)}</span></div>
          <div className="border-t border-white/20 pt-3 flex justify-between items-baseline">
            <span className="font-semibold">Brutto</span>
            <span className="text-2xl font-bold">{fmt(p.gross_amount)}</span>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm inline-flex items-center gap-1.5">
                Kundentext
                <span className="text-xs text-muted-foreground font-normal inline-flex items-center gap-1">
                  <Pencil className="h-3 w-3" /> bearbeitbar
                </span>
              </h3>
              <button onClick={copyText} className="text-xs text-primary font-medium inline-flex items-center gap-1 hover:underline">
                <Copy className="h-3.5 w-3.5" /> Kopieren
              </button>
            </div>
            <Textarea
              value={ai.customer_text}
              onChange={(e) => updateCustomerText(e.target.value)}
              className="min-h-[120px] text-sm leading-relaxed resize-y"
            />
          </div>
          <div className="border-t border-border pt-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm inline-flex items-center gap-1.5">
                WhatsApp-Text
                <span className="text-xs text-muted-foreground font-normal inline-flex items-center gap-1">
                  <Pencil className="h-3 w-3" /> bearbeitbar
                </span>
              </h3>
              <button onClick={copyWA} className="text-xs text-primary font-medium inline-flex items-center gap-1 hover:underline">
                <Copy className="h-3.5 w-3.5" /> Kopieren
              </button>
            </div>
            <Textarea
              value={whatsappDisplay}
              onChange={(e) => updateWhatsappText(e.target.value)}
              className="min-h-[160px] text-sm leading-relaxed resize-y"
            />
          </div>
        </div>

        {pdfAllowed ? (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={previewPDF} disabled={busy} className="h-12">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Eye className="h-4 w-4 mr-2" /> Vorschau</>}
            </Button>
            <Button onClick={() => setConfirmAction("download")} disabled={busy} className="h-12 gradient-primary text-primary-foreground border-0">
              <FileDown className="h-4 w-4 mr-2" /> PDF erstellen
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">PDF-Download im Profi-Tarif</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Im Starter erhältst du den Kunden- und WhatsApp-Text zum Kopieren – perfekt für eine schnelle Antwort.
                  Mit <strong className="text-foreground">Profi</strong> bekommst du zusätzlich ein professionelles PDF mit deinem Logo und deinen Firmenfarben.
                </p>
              </div>
            </div>
            <Button onClick={() => nav("/pricing")} className="w-full h-11 gradient-primary text-primary-foreground border-0">
              <Sparkles className="h-4 w-4 mr-2" /> Auf Profi upgraden
            </Button>
          </div>
        )}

        {previewFailed && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <p className="text-sm text-destructive">
              Die PDF-Vorschau konnte nicht automatisch geöffnet werden. Eventuell hat dein Browser das neue Fenster blockiert.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={retryPreview}
                disabled={busy}
                className="h-11 border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                {busy
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><RotateCw className="h-4 w-4 mr-2" /> Erneut öffnen</>}
              </Button>
              <Button
                type="button"
                onClick={() => setConfirmAction("download")}
                disabled={busy}
                className="h-11 gradient-primary text-primary-foreground border-0"
              >
                {busy
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><FileDown className="h-4 w-4 mr-2" /> Stattdessen herunterladen</>}
              </Button>
            </div>
            {previewBlobUrl && (
              <a
                href={previewBlobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary font-medium inline-flex items-center gap-1 hover:underline"
              >
                <Eye className="h-3.5 w-3.5" /> Direkt im neuen Tab öffnen
              </a>
            )}
          </div>
        )}

        {previewBlobUrl && !previewFailed && (
          <div className="rounded-xl border border-border bg-card p-4 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              PDF ist erstellt und bereit zur Vorschau oder zum Download.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreviewOpen(true)}
                className="h-11"
              >
                <Eye className="h-4 w-4 mr-2" /> Vorschau öffnen
              </Button>
              <Button
                type="button"
                onClick={() => setConfirmAction("download")}
                disabled={busy}
                className="h-11 gradient-primary text-primary-foreground border-0"
              >
                <FileDown className="h-4 w-4 mr-2" /> PDF laden
              </Button>
            </div>
          </div>
        )}

        <Button onClick={() => save()} disabled={busy || saved} variant={saved ? "secondary" : "default"} className="w-full h-12">
          {saved ? <><Check className="h-4 w-4 mr-2" /> Gespeichert</> : <><Save className="h-4 w-4 mr-2" /> Vorschlag speichern</>}
        </Button>
      </div>

      <AlertDialog open={confirmAction !== null} onOpenChange={(o) => { if (!o) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>PDF jetzt erstellen?</AlertDialogTitle>
            <AlertDialogDescription>
              Bitte prüfe die Inhalte oben sorgfältig. Mit dem Erstellen wird die Preisorientierung
              auf dein monatliches Kontingent angerechnet. Tipp: Über „Vorschau" kannst du das PDF
              vorher kostenlos ansehen. Möchtest du fortfahren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const action = confirmAction;
                setConfirmAction(null);
                if (action === "preview") previewPDF();
                else if (action === "download") downloadPDF();
              }}
            >
              Ja, jetzt erstellen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={shareOpen} onOpenChange={setShareOpen}>
        <AlertDialogContent className="text-center">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">PDF an deinen Kunden senden?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Das PDF wurde heruntergeladen. Du kannst es jetzt direkt an{" "}
              {data.customer?.name ? <strong>{data.customer.name}</strong> : "deinen Kunden"} senden.
              Das PDF musst du nach dem Öffnen aus deinem Download-Ordner anhängen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 pt-2">
            <Button
              type="button"
              onClick={sendViaEmail}
              disabled={!customerEmail}
              className="min-h-12 h-auto w-full justify-center whitespace-normal text-center py-2 px-3 leading-snug"
              variant="outline"
            >
              <Mail className="h-4 w-4 mr-2 shrink-0" />
              <span className="break-words">
                {customerEmail ? `Per E-Mail an ${customerEmail}` : "Per E-Mail senden (keine E-Mail-Adresse hinterlegt)"}
              </span>
            </Button>
            <Button
              type="button"
              onClick={sendViaWhatsapp}
              disabled={!waPhone}
              className="min-h-12 h-auto w-full justify-center whitespace-normal text-center py-2 px-3 leading-snug"
              variant="outline"
            >
              <MessageCircle className="h-4 w-4 mr-2 shrink-0" />
              <span className="break-words">
                {waPhone
                  ? `Per WhatsApp an ${customerPhone}`
                  : customerPhone
                    ? "WhatsApp – Telefonnummer ungültig"
                    : "Per WhatsApp senden (keine Handynummer hinterlegt)"}
              </span>
            </Button>
          </div>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogCancel className="w-full sm:w-auto">Schließen</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] max-h-[90dvh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border text-center">
            <DialogTitle className="text-center">PDF-Vorschau</DialogTitle>
            <DialogDescription className="text-center leading-relaxed">
              So wird dein PDF aussehen. Mit „PDF erstellen" wird es heruntergeladen und auf dein Kontingent angerechnet.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <PdfPreviewRenderer url={previewBlobUrl} />
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 border-t border-border bg-card">
            <Button variant="outline" onClick={() => setPreviewOpen(false)} className="h-11 min-w-0">
              Schließen
            </Button>
            <Button
              onClick={downloadFromPreview}
              disabled={busy}
              className="h-11 min-w-0 gradient-primary text-primary-foreground border-0"
            >
              <FileDown className="h-4 w-4 mr-2 shrink-0" />
              <span className="truncate">PDF erstellen & laden</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
