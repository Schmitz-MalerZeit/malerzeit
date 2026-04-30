import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, FileDown, Save, Loader2, Check, RotateCw, Eye, Lock, Sparkles } from "lucide-react";
import { buildQuotePDF, urlToDataUrl, getImageNaturalSize } from "@/lib/pdf";
import { useSubscription } from "@/hooks/useSubscription";
import { canDownloadPdf, canUseLogoInPdf, getTier } from "@/lib/planFeatures";

const fmt = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export default function QuoteResult() {
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
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

    // Restore previously generated PDF from sessionStorage if available
    const cachedB64 = sessionStorage.getItem("currentQuotePdf");
    if (cachedB64) {
      try {
        const bin = atob(cachedB64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        setPreviewBlobUrl(url);
      } catch (e) {
        console.warn("could not restore cached PDF", e);
        sessionStorage.removeItem("currentQuotePdf");
      }
    }
  }, [nav]);

  if (!data) return null;
  const ai = data.ai;
  const p = ai.pricing;

  const copyText = async () => {
    await navigator.clipboard.writeText(ai.customer_text);
    toast.success("Kundentext kopiert");
  };
  const copyWA = async () => {
    await navigator.clipboard.writeText(ai.whatsapp_text);
    toast.success("WhatsApp-Text kopiert");
  };

  const buildPDF = async () => {
    let logoDataUrl: string | undefined;
    let logoSize: { width: number; height: number } | undefined;
    if (logoAllowed && profile?.logo_url) {
      logoDataUrl = await urlToDataUrl(profile.logo_url);
      if (logoDataUrl) logoSize = await getImageNaturalSize(logoDataUrl);
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
    if (customerSlug) return `Preisvorschlag_${customerSlug}_${date}.pdf`;

    // 1) Prefer the first AI-curated line item (already concise & relevant)
    const firstLine: string | undefined = ai?.line_items?.[0];
    if (firstLine) {
      const lineSlug = slugify(topKeywords(firstLine, 5));
      if (lineSlug) return `Preisvorschlag_${lineSlug}_${date}.pdf`;
    }

    // 2) Fallback: keywords from the "Arbeiten" block of the description
    const workBlock = extractWorkBlock(data.description || "");
    const workSlug = slugify(topKeywords(workBlock, 5));
    if (workSlug) return `Preisvorschlag_${workSlug}_${date}.pdf`;

    // 3) Last resort: first ~6 words of the raw description
    const firstWords = (data.description || "").split(/\s+/).slice(0, 6).join(" ");
    const descSlug = slugify(firstWords);
    if (descSlug) return `Preisvorschlag_${descSlug}_${date}.pdf`;

    return `Preisvorschlag_${date}.pdf`;
  };

  const triggerBlobDownload = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename();
    document.body.appendChild(a);
    a.click();
    a.remove();
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
      // Reuse the preview blob if it has already been built (no extra quota cost)
      if (previewBlobUrl) {
        triggerBlobDownload(previewBlobUrl);
        setPreviewFailed(false);
        return;
      }
      const pdf = await buildPDF();                 // 1) build first (no cost if it fails)
      const ok = await consumeQuota();              // 2) atomically consume quota
      if (!ok) return;
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);                       // make it reusable for preview / retry
      await cachePdfInSession(blob);                // persist across reloads
      triggerBlobDownload(url);
      setPreviewFailed(false);
    } catch (e: any) { toast.error(e.message || "PDF-Fehler"); }
    finally { setBusy(false); }
  };

  const openBlob = (url: string): boolean => {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win || win.closed || typeof win.closed === "undefined") {
      setPreviewFailed(true);
      toast.error("Vorschau konnte nicht geöffnet werden (evtl. Popup blockiert).", {
        action: { label: "Erneut", onClick: () => retryPreview() },
      });
      return false;
    }
    setPreviewFailed(false);
    return true;
  };

  const retryPreview = () => {
    if (previewBlobUrl) openBlob(previewBlobUrl);
    else previewPDF();
  };

  const previewPDF = async () => {
    if (!guardPdfAccess()) return;
    setBusy(true);
    try {
      // Reuse already-built PDF if available (avoid double quota consumption)
      if (previewBlobUrl) {
        openBlob(previewBlobUrl);
        return;
      }
      const pdf = await buildPDF();
      const ok = await consumeQuota();
      if (!ok) return;
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
      await cachePdfInSession(blob);                // persist across reloads
      openBlob(url);
    } catch (e: any) {
      setPreviewFailed(true);
      toast.error(e.message || "PDF-Fehler", {
        action: { label: "Erneut", onClick: () => retryPreview() },
      });
    }
    finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true);
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
      toast.success("Vorschlag gespeichert");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const headerTitle = data.customer?.name?.trim() || "Preisvorschlag";

  return (
    <AppShell title={headerTitle}>
      <div className="space-y-5">
        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
          <h2 className="font-semibold mb-3 text-lg">Leistungen</h2>
          <ul className="space-y-2.5">
            {ai.line_items.map((item: string, i: number) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="text-primary font-bold mt-0.5">•</span>
                <span className="flex-1">{item}</span>
              </li>
            ))}
          </ul>
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
              <h3 className="font-semibold text-sm">Kundentext</h3>
              <button onClick={copyText} className="text-xs text-primary font-medium inline-flex items-center gap-1 hover:underline">
                <Copy className="h-3.5 w-3.5" /> Kopieren
              </button>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{ai.customer_text}</p>
          </div>
          <div className="border-t border-border pt-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm">WhatsApp-Text</h3>
              <button onClick={copyWA} className="text-xs text-primary font-medium inline-flex items-center gap-1 hover:underline">
                <Copy className="h-3.5 w-3.5" /> Kopieren
              </button>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{ai.whatsapp_text}</p>
          </div>
        </div>

        {pdfAllowed ? (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={previewPDF} disabled={busy} className="h-12">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>PDF ansehen</>}
            </Button>
            <Button onClick={downloadPDF} disabled={busy} className="h-12 gradient-primary text-primary-foreground border-0">
              <FileDown className="h-4 w-4 mr-2" /> Download
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
              Die PDF-Vorschau konnte nicht geöffnet werden. Eventuell hat dein Browser das neue Fenster blockiert.
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
                onClick={downloadPDF}
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

        <Button onClick={save} disabled={busy || saved} variant={saved ? "secondary" : "default"} className="w-full h-12">
          {saved ? <><Check className="h-4 w-4 mr-2" /> Gespeichert</> : <><Save className="h-4 w-4 mr-2" /> Vorschlag speichern</>}
        </Button>
      </div>
    </AppShell>
  );
}
