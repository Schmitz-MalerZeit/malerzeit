import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, FileDown, Save, Loader2, Check, Lock, Sparkles, Pencil, Plus, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { buildQuotePDF, urlToDataUrl, prepareLogoForPdf } from "@/lib/pdf";
import { ensureCustomerPriceOrientationText, ensureWhatsappPriceOrientationText, normalizePhoneForWa } from "@/lib/quoteText";
import { buildEmailMessageBody, buildWhatsappMessageBody } from "@/lib/messageText";
import { renderMessageTemplate, DEFAULT_EMAIL_TEMPLATE, DEFAULT_WHATSAPP_TEMPLATE, ensureWhatsappSignature } from "@/lib/messageTemplate";
import { PdfFlowSheet, type PdfFlowState } from "@/components/PdfFlowSheet";
import { AddonPurchaseDialog } from "@/components/AddonPurchaseDialog";
import { useSubscription } from "@/hooks/useSubscription";
import { canDownloadPdf, canUseLogoInPdf, canSendViaWhatsapp, getTier } from "@/lib/planFeatures";

const fmt = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

const blobToObjectUrl = (blob: Blob): string => URL.createObjectURL(blob);

export default function QuoteResult() {
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [pdfQuotaConsumed, setPdfQuotaConsumed] = useState(false);
  const [lastFilename, setLastFilename] = useState<string>("");
  const [lastSavedPdfPath, setLastSavedPdfPath] = useState<string | null>(null);
  const [pdfFlowOpen, setPdfFlowOpen] = useState(false);
  const [pdfFlow, setPdfFlow] = useState<PdfFlowState>({ phase: "idle" });
  const [lastSignedPdfUrl, setLastSignedPdfUrl] = useState<string | null>(null);
  const [addonDialogOpen, setAddonDialogOpen] = useState(false);
  const [addonDialogContext, setAddonDialogContext] = useState<string | undefined>(undefined);
  const subState = useSubscription();
  const tier = getTier(subState);
  const pdfAllowed = canDownloadPdf(tier);
  const logoAllowed = canUseLogoInPdf(tier);
  const whatsappAllowed = canSendViaWhatsapp(tier);

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
        const url = blobToObjectUrl(blob);
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
    // Mark as dirty: after edits the user can save again (UPDATE if a row
    // already exists, INSERT otherwise).
    setSaved(false);
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

  // Variablen für Nachrichten-Vorlagen
  const templateVars = {
    customerName: data.customer?.name || "",
    lineItems: ai.line_items || [],
    grossFormatted: fmt(p.gross_amount),
    netFormatted: fmt(p.net_amount),
    vatFormatted: fmt(p.vat_amount),
    companyName: profile?.company_name || "",
    signatureName: profile?.signatory_name || profile?.contact_person || profile?.company_name || "",
    validityDays: settings?.quote_validity_days ?? 14,
  };

  // WhatsApp-Text: editierte Version > Vorlage aus Settings (Sie-Form)
  const composeWhatsapp = (): string => {
    const tpl = settings?.whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE;
    return renderMessageTemplate(tpl, templateVars);
  };

  // E-Mail-Text: editierter Kundentext aus AI > Vorlage aus Settings (Sie-Form)
  const composeEmail = (): string => {
    if (ai.customer_text && ai.customer_text.trim()) return ai.customer_text;
    const tpl = settings?.email_template || DEFAULT_EMAIL_TEMPLATE;
    return renderMessageTemplate(tpl, templateVars);
  };

  const customerDisplay = ensureCustomerPriceOrientationText(composeEmail());
  const whatsappDisplay = ensureWhatsappSignature(
    ensureWhatsappPriceOrientationText(ai.whatsapp_edited ? (ai.whatsapp_text || "") : composeWhatsapp()),
    templateVars,
  );

  const copyText = async () => {
    await navigator.clipboard.writeText(customerDisplay);
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
        vatId: profile?.vat_id,
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
    if (error) {
      console.error("consume_pdf_quota RPC error", error);
      const detail = [error.message, (error as any).details, (error as any).hint, (error as any).code]
        .filter(Boolean).join(" · ");
      toast.error("Limit-Prüfung fehlgeschlagen", { description: detail || "Unbekannter Datenbank-Fehler" });
      return false;
    }
    const res = data as { ok: boolean; error?: string; limit?: number; used?: number; mode?: string };
    if (!res?.ok) {
      if (res?.error === "trial_exhausted") {
        toast.error(`Test-PDFs aufgebraucht (${res.used}/${res.limit}). Wähle einen Tarif, um weiter PDFs herunterzuladen.`, {
          action: { label: "Tarife", onClick: () => nav("/pricing") },
        });
      } else if (res?.error === "limit_reached") {
        setAddonDialogContext(`Du hast ${res.used} von ${res.limit} KI-Angeboten in diesem Monat genutzt.`);
        setAddonDialogOpen(true);
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

  const ensureSavedQuoteWithPdf = async (
    blob: Blob,
    fileName: string,
    onUploadProgress?: (loaded: number, total: number) => void,
  ): Promise<{ path: string; quoteId: string } | null> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Nicht angemeldet");

    const safeName = fileName.replace(/[^A-Za-z0-9._-]+/g, "_");
    const path = `${u.user.id}/${Date.now()}_${safeName}`;

    // Direct PUT to the storage REST endpoint so we can read upload progress
    // (the supabase-js client does not surface progress events).
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/quote-pdfs/${encodeURI(path)}`;
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Authorization", `Bearer ${token ?? ""}`);
      xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
      xhr.setRequestHeader("Content-Type", "application/pdf");
      xhr.setRequestHeader("x-upsert", "true");
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) onUploadProgress?.(ev.loaded, ev.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onUploadProgress?.(blob.size, blob.size);
          resolve();
        } else {
          reject(new Error(`Upload fehlgeschlagen (HTTP ${xhr.status}): ${xhr.responseText?.slice(0, 200) || ""}`));
        }
      };
      xhr.onerror = () => reject(new Error("Netzwerkfehler beim Upload"));
      xhr.onabort = () => reject(new Error("Upload abgebrochen"));
      xhr.send(blob);
    });

    const payload = {
      user_id: u.user.id,
      description: data.description,
      line_items: ai.line_items,
      customer_text: customerDisplay,
      whatsapp_text: whatsappDisplay,
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
      pdf_storage_path: path,
      pdf_filename: fileName,
      pdf_created_at: new Date().toISOString(),
      pdf_size_bytes: blob.size,
      pdf_mime_type: "application/pdf",
    };

    const query = savedQuoteId
      ? supabase.from("quotes").update(payload).eq("id", savedQuoteId).select("id, pdf_storage_path").single()
      : supabase.from("quotes").insert(payload).select("id, pdf_storage_path").single();
    const { data: inserted, error: insertError } = await query;
    if (insertError) throw insertError;

    setSaved(true);
    setSavedQuoteId(inserted.id);
    setLastSavedPdfPath(path);
    return { path: inserted.pdf_storage_path || path, quoteId: inserted.id };
  };

  const createSignedPdfUrl = async (path: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from("quote-pdfs")
      .createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) throw error || new Error("PDF-Link konnte nicht erstellt werden");
    return data.signedUrl;
  };




  const buildPdfFlowMeta = (_fileName: string) => {
    const subject = `Unverbindliche Preisorientierung${data.customer?.name ? " – " + data.customer.name : ""}`;
    // E-Mail- und WhatsApp-Texte nutzen den Inhalt der PDF, ABER:
    //  - keine Schluss-Grußformel/Signatur (Mail-/WA-Apps haben eigene Signaturen)
    //  - Brutto-Preis fett hervorgehoben
    // WhatsApp-Versand ist ein Profi-/Exklusiv-Feature: im Starter wird
    // `whatsappText` bewusst leer gelassen, damit das Sheet keinen WA-Button zeigt.
    const grossFormatted = fmt(p.gross_amount);
    const emailBody = buildEmailMessageBody(customerDisplay, { grossFormatted });
    const whatsappText = whatsappAllowed
      ? buildWhatsappMessageBody(whatsappDisplay, { grossFormatted })
      : "";
    return { subject, emailBody, whatsappText };
  };

  // Cache the freshly built PDF in sessionStorage so it survives a reload
  const cachePdfInSession = async (blob: Blob) => {
    try {
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      sessionStorage.setItem("currentQuotePdf", btoa(bin));
    } catch (e) {
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

  const runPdfFlow = async () => {
    // Open sheet immediately with "building" state — never a black screen.
    const fileName = filename();
    const meta = buildPdfFlowMeta(fileName);
    setPdfFlow({
      phase: "building",
      step: "PDF wird zusammengebaut …",
      progress: 5,
      fileName,
      ...meta,
      whatsappPhone: waPhone,
    });
    setPdfFlowOpen(true);
    setBusy(true);

    // Soft, monotone build progress (jsPDF is synchronous and gives no events).
    // We tick towards 90% so the user sees motion; the final 10% snap when
    // the blob is ready and we transition into the upload phase.
    const buildStart = performance.now();
    let buildPct = 5;
    const buildTimer = window.setInterval(() => {
      buildPct = Math.min(90, buildPct + 4);
      const elapsed = (performance.now() - buildStart) / 1000;
      const eta = Math.max(0, (elapsed / Math.max(buildPct, 1)) * (100 - buildPct));
      setPdfFlow((s) => s.phase === "building"
        ? { ...s, progress: buildPct, etaSeconds: eta }
        : s);
    }, 180);

    try {
      // 1) Build (or reuse) the PDF blob
      let blob: Blob | null = previewBlob;
      if (!blob) {
        setPdfFlow((s) => ({ ...s, step: "PDF wird erstellt …" }));
        const pdf = await buildPDF();
        // 2) Quota only consumed once we have a buildable PDF
        const ok = await consumeQuota();
        if (!ok) {
          // Quota errors already toast; close sheet quietly.
          window.clearInterval(buildTimer);
          setPdfFlowOpen(false);
          setPdfFlow({ phase: "idle" });
          return;
        }
        setPdfQuotaConsumed(true);
        blob = pdf.output("blob");
        const url = blobToObjectUrl(blob);
        setPreviewBlob(blob);
        setPreviewBlobUrl(url);
        await cachePdfInSession(blob);
      } else if (!pdfQuotaConsumed) {
        const ok = await consumeQuota();
        if (!ok) {
          window.clearInterval(buildTimer);
          setPdfFlowOpen(false);
          setPdfFlow({ phase: "idle" });
          return;
        }
        setPdfQuotaConsumed(true);
      }
      window.clearInterval(buildTimer);

      // 3) Upload + persist quote row — with REAL progress + ETA
      const uploadStart = performance.now();
      setPdfFlow((s) => ({
        ...s,
        phase: "uploading",
        step: "PDF wird hochgeladen …",
        progress: 0,
        loadedBytes: 0,
        totalBytes: blob!.size,
        etaSeconds: undefined,
      }));
      const savedPdf = await ensureSavedQuoteWithPdf(blob, fileName, (loaded, total) => {
        const pct = total > 0 ? (loaded / total) * 100 : 0;
        const elapsed = (performance.now() - uploadStart) / 1000;
        const speed = elapsed > 0 ? loaded / elapsed : 0; // bytes/s
        const remaining = speed > 0 ? (total - loaded) / speed : undefined;
        setPdfFlow((s) => s.phase === "uploading"
          ? { ...s, progress: pct, loadedBytes: loaded, totalBytes: total, etaSeconds: remaining }
          : s);
      });
      if (!savedPdf?.path) throw new Error("PDF konnte nicht gespeichert werden");

      // 4) Sign URL for preview + sharing
      setPdfFlow((s) => ({
        ...s,
        step: "Sicheren Link erstellen …",
        progress: 98,
        etaSeconds: 1,
      }));
      const signedUrl = await createSignedPdfUrl(savedPdf.path);
      setLastSignedPdfUrl(signedUrl);
      setLastFilename(fileName);

      setPdfFlow({
        phase: "ready",
        url: signedUrl,
        fileName,
        ...meta,
        whatsappPhone: waPhone,
        pdfBlob: blob,
      });
    } catch (e: any) {
      window.clearInterval(buildTimer);
      console.error("PDF flow failed", e);
      setPdfFlow((prev) => ({
        ...prev,
        phase: "error",
        errorMessage: e?.message || "Unbekannter Fehler beim Erstellen der PDF.",
        errorDetail: typeof e?.stack === "string" ? e.stack.split("\n").slice(0, 8).join("\n") : String(e),
      }));
    } finally {
      setBusy(false);
    }
  };

  const downloadPDF = async () => {
    if (!guardPdfAccess()) return;
    await runPdfFlow();
  };


  // Speichert den Vorschlag in der Datenbank. `silent=true` unterdrückt Toasts
  // und den Busy-Spinner – wird beim Auto-Speichern nach PDF-Erstellung genutzt.
  // Wenn bereits ein Datensatz existiert (savedQuoteId), wird ein UPDATE statt
  // INSERT ausgeführt – verhindert Duplikate, wenn der Nutzer nach dem
  // PDF-Erstellen noch manuell auf "Speichern" tippt.
  const save = async (silent = false) => {
    if (saved && !savedQuoteId) return; // already saved, nothing to update
    if (!silent) setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Nicht angemeldet");
      const payload = {
        user_id: u.user.id,
        description: data.description,
        line_items: ai.line_items,
        customer_text: customerDisplay,
        whatsapp_text: whatsappDisplay,
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
        pdf_storage_path: lastSavedPdfPath,
        pdf_filename: lastFilename || null,
        pdf_created_at: lastSavedPdfPath ? new Date().toISOString() : null,
        pdf_size_bytes: previewBlob?.size ?? null,
        pdf_mime_type: lastSavedPdfPath ? "application/pdf" : null,
      };

      const query = savedQuoteId
        ? supabase.from("quotes").update(payload).eq("id", savedQuoteId).select("id").single()
        : supabase.from("quotes").insert(payload).select("id").single();
      const { data: row, error } = await query;
      if (error) throw error;
      setSavedQuoteId(row.id);
      setSaved(true);
      if (!silent) toast.success(savedQuoteId ? "Vorschlag aktualisiert" : "Vorschlag gespeichert");
    } catch (e: any) {
      if (!silent) toast.error(e.message);
      else console.warn("Auto-Speichern fehlgeschlagen:", e?.message);
    }
    finally { if (!silent) setBusy(false); }
  };

  const headerTitle = data.customer?.name?.trim() || "Preisorientierung";

  // Telefonnummer für WhatsApp normalisieren.

  const customerPhone = (data.customer?.phone || "").trim();
  const waPhone = normalizePhoneForWa(customerPhone);

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
              value={customerDisplay}
              onChange={(e) => updateCustomerText(e.target.value)}
              className="min-h-[120px] text-sm leading-relaxed resize-y"
            />
          </div>
        </div>

        {pdfAllowed ? (
          <Button onClick={downloadPDF} disabled={busy} className="w-full h-12 gradient-primary text-primary-foreground border-0">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileDown className="h-4 w-4 mr-2" /> PDF jetzt erstellen</>}
          </Button>
        ) : (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">PDF-Download im Profi-Tarif</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Im Starter erhältst du den Kundentext zum Kopieren – perfekt für eine schnelle Antwort.
                  Mit <strong className="text-foreground">Profi</strong> bekommst du zusätzlich ein professionelles PDF mit deinem Logo und deinen Firmenfarben.
                </p>
              </div>
            </div>
            <Button onClick={() => nav("/pricing")} className="w-full h-11 gradient-primary text-primary-foreground border-0">
              <Sparkles className="h-4 w-4 mr-2" /> Auf Profi upgraden
            </Button>
          </div>
        )}

        <Button onClick={() => save()} disabled={busy || saved} variant={saved ? "secondary" : "default"} className="w-full h-12">
          {saved ? <><Check className="h-4 w-4 mr-2" /> Gespeichert</> : <><Save className="h-4 w-4 mr-2" /> Vorschlag speichern</>}
        </Button>
      </div>

      <PdfFlowSheet
        open={pdfFlowOpen}
        state={pdfFlow}
        onOpenChange={(o) => {
          setPdfFlowOpen(o);
          if (!o) {
            // Wenn die PDF erfolgreich erstellt wurde, leiten wir nach dem
            // Schließen zur Liste der gespeicherten Vorschläge weiter, damit
            // der Nutzer NICHT erneut auf der Eingabemaske landet (sonst würde
            // er versehentlich nochmal Kontingent verbrauchen).
            if (pdfFlow.phase === "ready") {
              setPdfFlow({ phase: "idle" });
              nav("/quotes");
              return;
            }
            if (pdfFlow.phase === "error") setPdfFlow({ phase: "idle" });
          }
        }}
        onRetry={() => { void runPdfFlow(); }}
        onAfterShareAction={() => {
          // Sheet sofort schließen + zur Liste der gespeicherten Vorschläge.
          // Damit landet der Nutzer beim Zurückkommen aus WhatsApp/Mail NICHT
          // wieder im PDF-Vorschau-Sheet, sondern in der Übersicht.
          setPdfFlowOpen(false);
          setPdfFlow({ phase: "idle" });
          nav("/quotes");
        }}
        fallbackUrl={lastSignedPdfUrl}
        fallbackFileName={lastFilename || null}
      />
      <AddonPurchaseDialog
        open={addonDialogOpen}
        onOpenChange={setAddonDialogOpen}
        contextLine={addonDialogContext}
      />
    </AppShell>
  );
}
