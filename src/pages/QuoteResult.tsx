import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, FileDown, Save, Loader2, Check, Lock, Sparkles, Pencil, Plus, Trash2, MessageCircle, Calculator, ArrowLeft } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { buildQuotePDF, urlToDataUrl, prepareLogoForPdf } from "@/lib/pdf";
import { ensureCustomerPriceOrientationText, ensureWhatsappPriceOrientationText, normalizePhoneForWa } from "@/lib/quoteText";
import { buildEmailMessageBody, buildWhatsappMessageBody } from "@/lib/messageText";
import { renderMessageTemplate, DEFAULT_EMAIL_TEMPLATE, DEFAULT_WHATSAPP_TEMPLATE, ensureWhatsappSignature } from "@/lib/messageTemplate";
import { PdfFlowSheet, type PdfFlowState } from "@/components/PdfFlowSheet";
import { AddonPurchaseDialog } from "@/components/AddonPurchaseDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSubscription } from "@/hooks/useSubscription";
import { canDownloadPdf, canUseLogoInPdf, canSendViaWhatsapp, getTier } from "@/lib/planFeatures";
import { useTr, currentLocale } from "@/lib/tr";
import i18n from "@/i18n";
import {
  initialQuotaConsumedForQuote,
  shouldConsumeQuota,
  quotaConsumedAfterEdit,
} from "@/lib/pdfQuota";

const fmt = (n: number) => n.toLocaleString(currentLocale(), { style: "currency", currency: "EUR" });

const blobToObjectUrl = (blob: Blob): string => URL.createObjectURL(blob);

export default function QuoteResult() {
  const tr = useTr();
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewBlobLang, setPreviewBlobLang] = useState<"de" | "en" | null>(null);
  const [translationCache, setTranslationCache] = useState<Record<string, {
    line_items: string[];
    sections: Array<{ title: string; items: string[] }>;
    closing_text: string;
  }>>({});
  const [pdfQuotaConsumed, setPdfQuotaConsumed] = useState(false);
  const [lastFilename, setLastFilename] = useState<string>("");
  const [lastSavedPdfPath, setLastSavedPdfPath] = useState<string | null>(null);
  const [pdfFlowOpen, setPdfFlowOpen] = useState(false);
  const [pdfFlow, setPdfFlow] = useState<PdfFlowState>({ phase: "idle" });
  const [lastSignedPdfUrl, setLastSignedPdfUrl] = useState<string | null>(null);
  const [addonDialogOpen, setAddonDialogOpen] = useState(false);
  const [addonDialogContext, setAddonDialogContext] = useState<string | undefined>(undefined);
  const [whatsappUpgradeOpen, setWhatsappUpgradeOpen] = useState(false);
  const [itemsDirty, setItemsDirty] = useState(false);
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [hourlyRates, setHourlyRates] = useState<Array<{ id: string; label: string; rate: number; is_default: boolean }>>([]);
  const [addDlg, setAddDlg] = useState<{
    open: boolean;
    sectionIdx: number | null;
    description: string;
    hours: string;
    rateId: string;
    materialNet: string;
  }>({ open: false, sectionIdx: null, description: "", hours: "", rateId: "", materialNet: "" });
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
    const raw = localStorage.getItem("currentQuote");
    if (!raw) { nav("/quote/new"); return; }
    const parsed = JSON.parse(raw);
    setData(parsed);
    if (parsed?.savedQuoteId) {
      setSavedQuoteId(parsed.savedQuoteId);
      setSaved(true);
    }
    if (parsed?.pdf_storage_path) {
      setLastSavedPdfPath(parsed.pdf_storage_path);
    }
    // Reopening a quote that already has a stored PDF must NOT count again
    // toward the monthly quota. Editing/recalc will reset this flag.
    if (initialQuotaConsumedForQuote(parsed)) {
      setPdfQuotaConsumed(true);
    }
    if (parsed?.pdf_filename) setLastFilename(parsed.pdf_filename);
    supabase.from("profiles").select("*").maybeSingle().then(({ data }) => setProfile(data));
    supabase.from("user_settings").select("*").maybeSingle().then(({ data }) => setSettings(data));
    supabase
      .from("hourly_rates")
      .select("id, label, rate, is_default")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        const list = (data || []).map((r: any) => ({
          id: r.id, label: r.label, rate: Number(r.rate) || 0, is_default: !!r.is_default,
        }));
        setHourlyRates(list);
      });

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
    localStorage.setItem("currentQuote", JSON.stringify(next));
    sessionStorage.removeItem("currentQuotePdf");
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setPreviewBlob(null);
    setPreviewBlobLang(null);
    setPdfQuotaConsumed(quotaConsumedAfterEdit());
    // Mark as dirty: after edits the user can save again (UPDATE if a row
    // already exists, INSERT otherwise).
    setSaved(false);
  };

  const persistItemsEdit = (next: any) => {
    persistEdits(next);
    setItemsDirty(true);
  };

  const recalcPrices = async () => {
    if (!data) return;
    setRecalcBusy(true);
    try {
      const { data: rates } = await supabase
        .from("hourly_rates")
        .select("label, rate, is_default")
        .order("sort_order", { ascending: true });
      const sections = Array.isArray(data.ai.sections) ? data.ai.sections : [];
      const cleanSections = sections
        .map((s: any) => ({
          title: (s?.title || "").trim(),
          items: Array.isArray(s?.items) ? s.items.filter((x: string) => x && x.trim()) : [],
        }))
        .filter((s: any) => s.title && s.items.length > 0);
      const cleanItems = (data.ai.line_items || []).filter((x: string) => x && x.trim());

      const { data: res, error } = await supabase.functions.invoke("recalc-quote", {
        body: {
          description: data.description,
          line_items: cleanItems,
          sections: cleanSections,
          hourlyRates: rates || [],
          materialMarkup: settings?.material_markup ?? 15,
          qualityLevel: settings?.quality_level ?? "standard",
          vatRate: data.ai.pricing?.vat_rate ?? settings?.vat_rate ?? 19,
        },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);

      const r: any = res;
      const nextSections = Array.isArray(r.sections) && r.sections.length > 0
        ? r.sections
        : sections;
      const nextAi = {
        ...data.ai,
        sections: nextSections,
        estimated_hours: r.estimated_hours,
        estimated_labor_cost: r.estimated_labor_cost,
        estimated_material_cost: r.estimated_material_cost,
        pricing: r.pricing,
      };
      const next = { ...data, ai: nextAi };
      setData(next);
      localStorage.setItem("currentQuote", JSON.stringify(next));
      sessionStorage.removeItem("currentQuotePdf");
      if (previewBlobUrl) { URL.revokeObjectURL(previewBlobUrl); setPreviewBlobUrl(null); }
      setPreviewBlob(null);
      setPreviewBlobLang(null);
      setPdfQuotaConsumed(quotaConsumedAfterEdit());
      setSaved(false);
      setItemsDirty(false);
      toast.success(tr("Preise neu berechnet", "Prices recalculated"));
    } catch (e: any) {
      toast.error(e.message || tr("Neuberechnung fehlgeschlagen", "Recalculation failed"));
    } finally {
      setRecalcBusy(false);
    }
  };

  const updateLineItem = (index: number, value: string) => {
    if (!data) return;
    const items = [...data.ai.line_items];
    items[index] = value;
    persistItemsEdit({ ...data, ai: { ...data.ai, line_items: items } });
  };
  const removeLineItem = (index: number) => {
    if (!data) return;
    const items = data.ai.line_items.filter((_: string, i: number) => i !== index);
    persistItemsEdit({ ...data, ai: { ...data.ai, line_items: items } });
  };
  const openAddDialog = (sectionIdx: number | null) => {
    const def = hourlyRates.find((r) => r.is_default) || hourlyRates[0];
    setAddDlg({
      open: true,
      sectionIdx,
      description: "",
      hours: "",
      rateId: def?.id || "",
      materialNet: "",
    });
  };
  const addLineItem = () => openAddDialog(null);

  // Apply the dialog: insert the new position into items/sections AND update
  // pricing/sections subtotals deterministically (no AI call). The user can
  // still hit "Preise neu berechnen" afterwards if they want a full re-eval.
  const confirmAddPosition = () => {
    if (!data) return;
    const desc = addDlg.description.trim();
    if (!desc) { toast.error(tr("Bitte eine Beschreibung eingeben.", "Please enter a description.")); return; }
    const hours = Number((addDlg.hours || "0").replace(",", ".")) || 0;
    const materialNet = Number((addDlg.materialNet || "0").replace(",", ".")) || 0;
    const rate = hourlyRates.find((r) => r.id === addDlg.rateId);
    const hourlyRate = rate?.rate || 0;
    const labor = Math.round(hours * hourlyRate);
    const markup = Number(settings?.material_markup ?? 15);
    const materialGross = Math.round(materialNet * (1 + markup / 100));
    const addNet = labor + materialGross;
    const vatRate = Number(data.ai?.pricing?.vat_rate ?? settings?.vat_rate ?? 19);
    const addVat = Math.round(addNet * (vatRate / 100) * 100) / 100;
    const addGross = Math.round((addNet + addVat) * 100) / 100;

    // Build updated sections / items
    const sections = Array.isArray(data.ai.sections) ? [...data.ai.sections] : [];
    let nextSections = sections;
    let nextLineItems: string[] = [...(data.ai.line_items || [])];
    if (addDlg.sectionIdx !== null && sections[addDlg.sectionIdx]) {
      const sIdx = addDlg.sectionIdx;
      const sec = { ...sections[sIdx] };
      sec.items = [...(sec.items || []), desc];
      sec.hours = (Number(sec.hours) || 0) + hours;
      sec.labor_cost = (Number(sec.labor_cost) || 0) + labor;
      sec.material_cost = (Number(sec.material_cost) || 0) + materialGross;
      sec.net_amount = (Number(sec.net_amount) || 0) + addNet;
      sec.vat_amount = Math.round(((Number(sec.vat_amount) || 0) + addVat) * 100) / 100;
      sec.gross_amount = Math.round(((Number(sec.gross_amount) || 0) + addGross) * 100) / 100;
      nextSections = [...sections];
      nextSections[sIdx] = sec;
      nextLineItems = nextSections.flatMap((s: any) => s.items);
    } else {
      nextLineItems = [...nextLineItems, desc];
    }

    // Update overall pricing
    const prevP = data.ai.pricing || {};
    const newPricing = {
      ...prevP,
      vat_rate: vatRate,
      labor_cost: (Number(prevP.labor_cost) || 0) + labor,
      material_cost: (Number(prevP.material_cost) || 0) + materialGross,
      net_amount: (Number(prevP.net_amount) || 0) + addNet,
      vat_amount: Math.round(((Number(prevP.vat_amount) || 0) + addVat) * 100) / 100,
      gross_amount: Math.round(((Number(prevP.gross_amount) || 0) + addGross) * 100) / 100,
    };

    const nextAi = {
      ...data.ai,
      sections: nextSections,
      line_items: nextLineItems,
      estimated_hours: (Number(data.ai.estimated_hours) || 0) + hours,
      estimated_labor_cost: (Number(data.ai.estimated_labor_cost) || 0) + labor,
      estimated_material_cost: (Number(data.ai.estimated_material_cost) || 0) + materialNet,
      pricing: newPricing,
    };
    const next = { ...data, ai: nextAi };
    // Use persistEdits (NOT persistItemsEdit) – the pricing is already up to
    // date, so we don't want the "Preise neu berechnen" banner to appear.
    persistEdits(next);
    setAddDlg((s) => ({ ...s, open: false }));
    toast.success(tr("Position hinzugefügt", "Item added"));
  };

  // ---- Section helpers (Räume/Bereiche) ----------------------------------
  // Beim Editieren von Sections halten wir line_items automatisch synchron
  // (flach, in Reihenfolge der Sections), damit PDF/WhatsApp/Templates
  // konsistent bleiben.
  const flattenSections = (sections: Array<{ title: string; items: string[] }>) =>
    sections.flatMap((s) => s.items);

  const setSections = (sections: Array<{ title: string; items: string[] }>) => {
    if (!data) return;
    persistItemsEdit({
      ...data,
      ai: { ...data.ai, sections, line_items: flattenSections(sections) },
    });
  };

  const updateSectionTitle = (sIdx: number, value: string) => {
    if (!data) return;
    const next = [...(data.ai.sections || [])];
    next[sIdx] = { ...next[sIdx], title: value };
    setSections(next);
  };
  const updateSectionItem = (sIdx: number, iIdx: number, value: string) => {
    if (!data) return;
    const next = [...(data.ai.sections || [])];
    const items = [...next[sIdx].items];
    items[iIdx] = value;
    next[sIdx] = { ...next[sIdx], items };
    setSections(next);
  };
  const removeSectionItem = (sIdx: number, iIdx: number) => {
    if (!data) return;
    const next = [...(data.ai.sections || [])];
    const items = next[sIdx].items.filter((_: string, i: number) => i !== iIdx);
    next[sIdx] = { ...next[sIdx], items };
    setSections(next);
  };
  const addSectionItem = (sIdx: number) => {
    if (!data) return;
    const next = [...(data.ai.sections || [])];
    next[sIdx] = { ...next[sIdx], items: [...next[sIdx].items, ""] };
    setSections(next);
  };
  const removeSection = (sIdx: number) => {
    if (!data) return;
    const next = (data.ai.sections || []).filter((_: any, i: number) => i !== sIdx);
    setSections(next);
  };
  const addSection = () => {
    if (!data) return;
    const next = [...(data.ai.sections || []), { title: tr("Neuer Bereich", "New section"), items: [""] }];
    setSections(next);
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

  // Allgemeiner Aufschlag (nur in dieser Kontroll-Ansicht eingebbar). Erscheint
  // NICHT als eigene Position im PDF, erhöht aber Netto / MwSt. / Brutto.
  const surcharge: { mode: "percent" | "amount"; value: number } =
    ai.surcharge && (ai.surcharge.mode === "percent" || ai.surcharge.mode === "amount")
      ? { mode: ai.surcharge.mode, value: Number(ai.surcharge.value) || 0 }
      : { mode: "percent", value: 0 };
  const baseNet = Number(p.net_amount) || 0;
  const vatRate = Number(p.vat_rate) || 19;
  const surchargeNet = Math.round(
    (surcharge.mode === "percent" ? baseNet * (surcharge.value / 100) : surcharge.value) * 100,
  ) / 100;
  const effNet = Math.round((baseNet + surchargeNet) * 100) / 100;
  const effVat = Math.round(effNet * (vatRate / 100) * 100) / 100;
  const effGross = Math.round((effNet + effVat) * 100) / 100;

  const updateSurcharge = (next: { mode: "percent" | "amount"; value: number }) => {
    persistEdits({ ...data, ai: { ...data.ai, surcharge: next } });
  };

  // Variablen für Nachrichten-Vorlagen
  const templateVars = {
    customerName: data.customer?.name || "",
    lineItems: ai.line_items || [],
    sections: Array.isArray(ai.sections) ? ai.sections : null,
    grossFormatted: fmt(effGross),
    netFormatted: fmt(effNet),
    vatFormatted: fmt(effVat),
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
    toast.success(tr("Kundentext kopiert", "Customer text copied"));
  };
  const copyWA = async () => {
    await navigator.clipboard.writeText(whatsappDisplay);
    toast.success(tr("WhatsApp-Text kopiert", "WhatsApp text copied"));
  };

  const buildPDF = async (lang: "de" | "en") => {
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
    // Aufschlag proportional auf Bereichs-Zwischensummen verteilen, damit die
    // Summen der Positionen im PDF zur ausgewiesenen Gesamtsumme passen.
    const rawSections = Array.isArray(ai.sections) ? ai.sections : [];
    const factor = baseNet > 0 ? effNet / baseNet : 1;
    const scaledSections = rawSections.map((s: any) => {
      const sNet = typeof s?.net_amount === "number" ? s.net_amount : 0;
      const newNet = Math.round(sNet * factor * 100) / 100;
      const newVat = Math.round(newNet * (vatRate / 100) * 100) / 100;
      const newGross = Math.round((newNet + newVat) * 100) / 100;
      const scale = sNet > 0 ? newNet / sNet : 1;
      return {
        ...s,
        labor_cost: typeof s?.labor_cost === "number"
          ? Math.round(s.labor_cost * scale * 100) / 100 : s?.labor_cost,
        material_cost: typeof s?.material_cost === "number"
          ? Math.round(s.material_cost * scale * 100) / 100 : s?.material_cost,
        net_amount: newNet,
        vat_amount: newVat,
        gross_amount: newGross,
      };
    });
    // For English PDFs, translate dynamic content (sections, line items, closing text)
    // via the translate-quote edge function. The structured AI content is generated
    // in German by default; here we localize it on demand.
    let translatedLineItems: string[] = ai.line_items || [];
    let translatedSections = scaledSections;
    let resolvedClosing = settings?.closing_text ?? (lang === "en"
      ? "If our offer suits you, we look forward to your order confirmation."
      : "Sollte Ihnen unser Angebot zusagen, freuen wir uns über Ihre Auftragszusage.");

    if (lang === "en") {
      const cacheKey = JSON.stringify({
        li: translatedLineItems,
        s: translatedSections.map((s: any) => ({ t: s.title, i: s.items })),
        c: resolvedClosing,
      });
      const cached = translationCache[cacheKey];
      if (cached) {
        translatedLineItems = cached.line_items;
        translatedSections = translatedSections.map((s: any, i: number) => ({
          ...s,
          title: cached.sections[i]?.title ?? s.title,
          items: cached.sections[i]?.items ?? s.items,
        }));
        resolvedClosing = cached.closing_text;
      } else {
        try {
          const { data: tData, error: tErr } = await supabase.functions.invoke("translate-quote", {
            body: {
              targetLang: "en",
              line_items: translatedLineItems,
              sections: translatedSections.map((s: any) => ({ title: s.title, items: s.items })),
              closing_text: resolvedClosing,
            },
          });
          if (!tErr && tData) {
            if (Array.isArray(tData.line_items) && tData.line_items.length === translatedLineItems.length) {
              translatedLineItems = tData.line_items;
            }
            if (Array.isArray(tData.sections) && tData.sections.length === translatedSections.length) {
              translatedSections = translatedSections.map((s: any, i: number) => ({
                ...s,
                title: tData.sections[i]?.title ?? s.title,
                items: Array.isArray(tData.sections[i]?.items) && tData.sections[i].items.length === s.items.length
                  ? tData.sections[i].items : s.items,
              }));
            }
            if (typeof tData.closing_text === "string" && tData.closing_text.trim()) {
              resolvedClosing = tData.closing_text;
            }
            setTranslationCache((c) => ({
              ...c,
              [cacheKey]: {
                line_items: translatedLineItems,
                sections: translatedSections.map((s: any) => ({ title: s.title, items: s.items })),
                closing_text: resolvedClosing,
              },
            }));
          } else if (tErr) {
            console.warn("translate-quote failed, falling back to source language:", tErr);
          }
        } catch (e) {
          console.warn("translate-quote threw, falling back to source language:", e);
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
        projectLabel: (data.customer as any).project_label,
        address: data.customer.address,
        postalCode: data.customer.postal_code,
        city: data.customer.city,
      } : undefined,
      date: new Date().toLocaleDateString(lang === "en" ? "en-US" : "de-DE"),
      lineItems: translatedLineItems,
      sections: translatedSections,
      net: effNet, vat: effVat, gross: effGross, vatRate: vatRate,
      validityDays: settings?.quote_validity_days ?? 14,
      closingText: resolvedClosing,
      signatureName: profile?.signatory_name || profile?.contact_person || profile?.company_name,
      lang,
    });
  };

  const consumeQuota = async (): Promise<boolean> => {
    const { data, error } = await supabase.rpc("consume_pdf_quota");
    if (error) {
      console.error("consume_pdf_quota RPC error", error);
      const detail = [error.message, (error as any).details, (error as any).hint, (error as any).code]
        .filter(Boolean).join(" · ");
      toast.error(tr("Limit-Prüfung fehlgeschlagen", "Limit check failed"), { description: detail || tr("Unbekannter Datenbank-Fehler", "Unknown database error") });
      return false;
    }
    const res = data as { ok: boolean; error?: string; limit?: number; used?: number; mode?: string };
    if (!res?.ok) {
      if (res?.error === "trial_exhausted") {
        setAddonDialogContext(tr(
          `Deine kostenlosen Test-PDFs sind aufgebraucht (${res.used}/${res.limit}). Lade jetzt zusätzliche PDFs nach oder wechsle in einen Tarif – so kannst du sofort weiterarbeiten.`,
          `Your free trial PDFs are used up (${res.used}/${res.limit}). Top up extra PDFs now or switch to a plan to keep going right away.`,
        ));
        setAddonDialogOpen(true);
      } else if (res?.error === "limit_reached") {
        setAddonDialogContext(tr(`Du hast ${res.used} von ${res.limit} KI-Angeboten in diesem Monat genutzt.`, `You've used ${res.used} of ${res.limit} AI quotes this month.`));
        setAddonDialogOpen(true);
      } else if (res?.error === "no_active_plan") {
        setAddonDialogContext(tr(
          "Du hast aktuell keinen aktiven Tarif. Buche zusätzliche PDFs für sofortige Nutzung oder wähle einen passenden Tarif.",
          "You don't have an active plan right now. Buy extra PDFs for instant use or pick a plan that fits you.",
        ));
        setAddonDialogOpen(true);
      } else {
        toast.error(tr("PDF-Erstellung nicht erlaubt.", "PDF creation not allowed."));
      }
      return false;
    }
    // Kontingent-Anzeige (Home/Billing) sofort aktualisieren
    void subState.refresh();
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
    const base = tr("Preisorientierung", "PriceEstimate");
    if (customerSlug) return `${base}_${customerSlug}_${date}.pdf`;

    const firstLine: string | undefined = ai?.line_items?.[0];
    if (firstLine) {
      const lineSlug = slugify(topKeywords(firstLine, 5));
      if (lineSlug) return `${base}_${lineSlug}_${date}.pdf`;
    }

    const workBlock = extractWorkBlock(data.description || "");
    const workSlug = slugify(topKeywords(workBlock, 5));
    if (workSlug) return `${base}_${workSlug}_${date}.pdf`;

    const firstWords = (data.description || "").split(/\s+/).slice(0, 6).join(" ");
    const descSlug = slugify(firstWords);
    if (descSlug) return `${base}_${descSlug}_${date}.pdf`;

    return `${base}_${date}.pdf`;
  };

  const ensureSavedQuoteWithPdf = async (
    blob: Blob,
    fileName: string,
    onUploadProgress?: (loaded: number, total: number) => void,
  ): Promise<{ path: string; quoteId: string } | null> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error(tr("Nicht angemeldet", "Not signed in"));

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
          reject(new Error(tr(`Upload fehlgeschlagen (HTTP ${xhr.status}): ${xhr.responseText?.slice(0, 200) || ""}`, `Upload failed (HTTP ${xhr.status}): ${xhr.responseText?.slice(0, 200) || ""}`)));
        }
      };
      xhr.onerror = () => reject(new Error(tr("Netzwerkfehler beim Upload", "Network error during upload")));
      xhr.onabort = () => reject(new Error(tr("Upload abgebrochen", "Upload aborted")));
      xhr.send(blob);
    });

    const payload = {
      user_id: u.user.id,
      description: data.description,
      line_items: ai.line_items,
      sections: Array.isArray(ai.sections) ? ai.sections : [],
      customer_text: customerDisplay,
      whatsapp_text: whatsappDisplay,
      net_amount: effNet,
      vat_amount: effVat,
      gross_amount: effGross,
      vat_rate: vatRate,
      estimated_hours: ai.estimated_hours,
      estimated_material: ai.estimated_material_cost,
      customer_name: data.customer?.name || null,
      customer_address: data.customer?.address || null,
      customer_postal_code: data.customer?.postal_code || null,
      customer_city: data.customer?.city || null,
      customer_phone: data.customer?.phone || null,
      customer_email: data.customer?.email || null,
      project_label: (data.customer as any)?.project_label || null,
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
    if (error || !data?.signedUrl) throw error || new Error(tr("PDF-Link konnte nicht erstellt werden", "Could not create PDF link"));
    return data.signedUrl;
  };




  const buildPdfFlowMeta = (_fileName: string) => {
    const subject = `${tr("Unverbindliche Preisorientierung", "Non-binding price estimate")}${data.customer?.name ? " – " + data.customer.name : ""}`;
    // E-Mail- und WhatsApp-Texte nutzen den Inhalt der PDF, ABER:
    //  - keine Schluss-Grußformel/Signatur (Mail-/WA-Apps haben eigene Signaturen)
    //  - Brutto-Preis fett hervorgehoben
    // WhatsApp-Versand ist ein Profi-/Exklusiv-Feature: im Starter wird
    // `whatsappText` bewusst leer gelassen, damit das Sheet keinen WA-Button zeigt.
    const grossFormatted = fmt(effGross);
    const projectLabel = (data.customer as any)?.project_label || "";
    const emailBody = buildEmailMessageBody(customerDisplay, { grossFormatted, projectLabel });
    const whatsappText = whatsappAllowed
      ? buildWhatsappMessageBody(whatsappDisplay, { grossFormatted, projectLabel })
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
    toast.error(tr("PDF-Download ist ab dem Profi-Tarif verfügbar.", "PDF download is available from the Pro plan."), {
      action: { label: tr("Tarife ansehen", "View plans"), onClick: () => nav("/pricing") },
    });
    return false;
  };

  const runPdfFlow = async (autoShareWhatsapp = false, lang: "de" | "en" = (i18n.language?.toLowerCase().startsWith("en") ? "en" : "de")) => {
    // Open sheet immediately with "building" state — never a black screen.
    const fileName = filename();
    const meta = buildPdfFlowMeta(fileName);
    setPdfFlow({
      phase: "building",
      step: tr("PDF wird zusammengebaut …", "Building PDF…"),
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
      // Invalidate cached blob if it was built in a different language.
      let blob: Blob | null = previewBlobLang === lang ? previewBlob : null;
      if (!blob) {
        if (previewBlobUrl) { URL.revokeObjectURL(previewBlobUrl); setPreviewBlobUrl(null); }
        setPreviewBlob(null);
        setPdfFlow((s) => ({ ...s, step: tr("PDF wird erstellt …", "Creating PDF…") }));
        const pdf = await buildPDF(lang);
        // 2) Quota only consumed once per quote version. If this quote was
        // already counted (freshly created OR reopened from storage), do NOT
        // count it again — only edits/recalc reset pdfQuotaConsumed.
        if (shouldConsumeQuota({ pdfQuotaConsumed })) {
          const ok = await consumeQuota();
          if (!ok) {
            // Quota errors already toast; close sheet quietly.
            window.clearInterval(buildTimer);
            setPdfFlowOpen(false);
            setPdfFlow({ phase: "idle" });
            return;
          }
          setPdfQuotaConsumed(true);
        }
        blob = pdf.output("blob");
        const url = blobToObjectUrl(blob);
        setPreviewBlob(blob);
        setPreviewBlobLang(lang);
        setPreviewBlobUrl(url);
        await cachePdfInSession(blob);
      } else if (shouldConsumeQuota({ pdfQuotaConsumed })) {
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
        step: tr("PDF wird hochgeladen …", "Uploading PDF…"),
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
      if (!savedPdf?.path) throw new Error(tr("PDF konnte nicht gespeichert werden", "PDF could not be saved"));

      // 4) Sign URL for preview + sharing
      setPdfFlow((s) => ({
        ...s,
        step: tr("Sicheren Link erstellen …", "Creating secure link…"),
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

      // Direkt-Versand via WhatsApp: identisches Verhalten wie der WhatsApp-Button
      // im PdfFlowSheet (gespeicherte Vorschläge) – echter Datei-Anhang via Web
      // Share API, sonst wa.me-Fallback mit lokalem Download.
      if (autoShareWhatsapp && meta.whatsappText) {
        const file = (() => {
          try {
            return new File([blob], fileName, { type: blob.type || "application/pdf" });
          } catch { return null; }
        })();
        const canShareFile = !!file
          && typeof navigator.canShare === "function"
          && navigator.canShare({ files: [file] });

        if (canShareFile && file) {
          try {
            await navigator.share({ files: [file], title: fileName });
            toast.message(tr("Wähle WhatsApp im Teilen-Menü", "Choose WhatsApp from the share menu"), {
              description: tr("Die PDF wird dann als Datei mitgeschickt.", "The PDF will be sent as a file."),
            });
            setPdfFlowOpen(false);
            setPdfFlow({ phase: "idle" });
            nav("/quotes");
            return;
          } catch (err) {
            if (!(err instanceof DOMException && err.name === "AbortError")) {
              console.warn(tr("WhatsApp File-Share fehlgeschlagen, Fallback wa.me:", "WhatsApp file share failed, fallback wa.me:"), err);
            } else {
              return;
            }
          }
        }

        // Fallback: PDF lokal herunterladen + wa.me öffnen
        try {
          const dlUrl = (() => {
            try {
              const u = new URL(signedUrl);
              u.searchParams.set("download", fileName);
              return u.toString();
            } catch { return signedUrl; }
          })();
          const a = document.createElement("a");
          a.href = dlUrl;
          a.download = fileName;
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch (err) {
          console.warn(tr("PDF-Vorab-Download fehlgeschlagen:", "PDF pre-download failed:"), err);
        }
        toast.message(tr("PDF wurde heruntergeladen", "PDF was downloaded"), {
          description: tr("WhatsApp öffnet sich – hänge die PDF aus dem Download-Ordner an.", "WhatsApp will open — attach the PDF from your downloads folder."),
        });
        const base = waPhone ? `https://wa.me/${waPhone}` : "https://wa.me/";
        const waUrl = `${base}?text=${encodeURIComponent(meta.whatsappText)}`;
        const waA = document.createElement("a");
        waA.href = waUrl;
        waA.target = "_blank";
        waA.rel = "noopener noreferrer";
        document.body.appendChild(waA);
        waA.click();
        document.body.removeChild(waA);
        setPdfFlowOpen(false);
        setPdfFlow({ phase: "idle" });
        nav("/quotes");
      }
    } catch (e: any) {
      window.clearInterval(buildTimer);
      console.error("PDF flow failed", e);
      setPdfFlow((prev) => ({
        ...prev,
        phase: "error",
        errorMessage: e?.message || tr("Unbekannter Fehler beim Erstellen der PDF.", "Unknown error while creating the PDF."),
        errorDetail: typeof e?.stack === "string" ? e.stack.split("\n").slice(0, 8).join("\n") : String(e),
      }));
    } finally {
      setBusy(false);
    }
  };

  const downloadPDF = async (lang?: "de" | "en") => {
    if (!guardPdfAccess()) return;
    await runPdfFlow(false, lang);
  };

  const sendWhatsappDirect = () => {
    if (!whatsappAllowed) {
      setWhatsappUpgradeOpen(true);
      return;
    }
    // Kein PDF erzeugen – nur den vorbereiteten WhatsApp-Text öffnen.
    // Brutto-Preis fett im Text wie im PdfFlowSheet.
    const grossFormatted = fmt(effGross);
    const projectLabel = (data.customer as any)?.project_label || "";
    const text = buildWhatsappMessageBody(whatsappDisplay, { grossFormatted, projectLabel });
    const base = waPhone ? `https://wa.me/${waPhone}` : "https://wa.me/";
    const waUrl = `${base}?text=${encodeURIComponent(text)}`;
    const a = document.createElement("a");
    a.href = waUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
      if (!u.user) throw new Error(tr("Nicht angemeldet", "Not signed in"));
      const payload = {
        user_id: u.user.id,
        description: data.description,
        line_items: ai.line_items,
        sections: Array.isArray(ai.sections) ? ai.sections : [],
        customer_text: customerDisplay,
        whatsapp_text: whatsappDisplay,
        net_amount: effNet,
        vat_amount: effVat,
        gross_amount: effGross,
        vat_rate: vatRate,
        estimated_hours: ai.estimated_hours,
        estimated_material: ai.estimated_material_cost,
        customer_name: data.customer?.name || null,
        customer_address: data.customer?.address || null,
        customer_postal_code: data.customer?.postal_code || null,
        customer_city: data.customer?.city || null,
        customer_phone: data.customer?.phone || null,
        customer_email: data.customer?.email || null,
        project_label: (data.customer as any)?.project_label || null,
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
      if (!silent) toast.success(savedQuoteId ? tr("Vorschlag aktualisiert", "Quote updated") : tr("Vorschlag gespeichert", "Quote saved"));
    } catch (e: any) {
      if (!silent) toast.error(e.message);
      else console.warn(tr("Auto-Speichern fehlgeschlagen:", "Auto-save failed:"), e?.message);
    }
    finally { if (!silent) setBusy(false); }
  };

  const headerTitle = data.customer?.name?.trim() || tr("Preisorientierung", "Price estimate");

  // Telefonnummer für WhatsApp normalisieren – nur ab Profi/Exklusiv aktiv.

  const customerPhone = (data.customer?.phone || "").trim();
  const waPhone = whatsappAllowed ? normalizePhoneForWa(customerPhone) : null;

  return (
    <AppShell title={headerTitle}>
      <div className="space-y-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => nav("/quote/new")}
          className="-ml-2 h-9 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> {tr("Zurück zur Eingabe", "Back to input")}
        </Button>
        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">{tr("Leistungen", "Services")}</h2>
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Pencil className="h-3 w-3" /> {tr("bearbeitbar", "editable")}
            </span>
          </div>
          {Array.isArray(ai.sections) && ai.sections.length > 0 ? (
            <div className="space-y-5">
              {ai.sections.map((sec: any, sIdx: number) => (
                <div key={sIdx} className="space-y-2 rounded-xl border border-border/60 bg-secondary/30 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) => updateSectionTitle(sIdx, e.target.value)}
                      className="flex-1 bg-transparent border-0 border-b border-border focus:border-primary focus:outline-none text-sm font-semibold text-foreground py-1"
                      placeholder={tr("Bereich (z. B. Wohnzimmer)", "Section (e.g. Living room)")}
                    />
                    <button
                      type="button"
                      onClick={() => removeSection(sIdx)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label={tr("Bereich entfernen", "Remove section")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <ul className="space-y-2 pl-1">
                    {sec.items.map((item: string, iIdx: number) => (
                      <li key={iIdx} className="flex gap-2 items-start">
                        <span className="text-primary font-bold mt-2.5">•</span>
                        <Textarea
                          value={item}
                          onChange={(e) => updateSectionItem(sIdx, iIdx, e.target.value)}
                          rows={1}
                          className="flex-1 min-h-[40px] text-sm resize-y"
                        />
                        <button
                          type="button"
                          onClick={() => removeSectionItem(sIdx, iIdx)}
                          className="mt-2 text-muted-foreground hover:text-destructive transition-colors"
                          aria-label={tr("Position entfernen", "Remove item")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openAddDialog(sIdx)}
                    className="h-8 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> {tr("Position", "Item")}
                  </Button>
                  {(typeof sec.net_amount === "number" || typeof sec.gross_amount === "number") && (
                    <div className="mt-2 pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {tr("Zwischensumme", "Subtotal")} {sec.title}
                        {typeof sec.hours === "number" && sec.hours > 0 ? ` · ${sec.hours.toLocaleString(currentLocale())} ${tr("Std", "hrs")}` : ""}
                        {typeof sec.net_amount === "number" ? ` · ${tr("Netto", "Net")} ${fmt(sec.net_amount)}` : ""}
                      </span>
                      {typeof sec.gross_amount === "number" && (
                        <span className="font-semibold text-primary">{tr("Brutto", "Gross")} {fmt(sec.gross_amount)}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSection}
                className="h-9"
              >
                <Plus className="h-4 w-4 mr-1.5" /> {tr("Bereich hinzufügen", "Add section")}
              </Button>
            </div>
          ) : (
            <>
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
                      aria-label={tr("Position entfernen", "Remove item")}
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
                <Plus className="h-4 w-4 mr-1.5" /> {tr("Position hinzufügen", "Add item")}
              </Button>
            </>
          )}

          {itemsDirty && (
            <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-xs text-foreground">
                {tr("Du hast Positionen geändert. Lass die Preise neu berechnen, damit Stunden, Lohn und Material zur neuen Liste passen.", "You changed items. Recalculate prices so hours, labor and materials match the new list.")}
              </p>
              <Button
                type="button"
                size="sm"
                onClick={recalcPrices}
                disabled={recalcBusy}
                className="h-9 shrink-0"
              >
                {recalcBusy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Calculator className="h-4 w-4 mr-1.5" />}
                {tr("Preise neu berechnen", "Recalculate prices")}
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-secondary/50 border border-border p-4 text-xs text-muted-foreground leading-relaxed">
          {tr("Der ausgewiesene Preis berücksichtigt einen geschätzten Arbeitslohn sowie den voraussichtlichen Materialeinsatz auf Grundlage der angegebenen Informationen.", "The price shown reflects estimated labor cost plus expected materials based on the information provided.")}
        </div>

        <div className="rounded-2xl bg-card border border-border p-4 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{tr("Allgemeiner Aufschlag", "General surcharge")}</h3>
            <span className="text-xs text-muted-foreground">{tr("erscheint nicht im PDF", "not shown in PDF")}</span>
          </div>
          <div className="grid grid-cols-[140px_1fr_28px] gap-2 items-center">
            <Select
              value={surcharge.mode}
              onValueChange={(v) => updateSurcharge({ mode: v as "percent" | "amount", value: surcharge.value })}
            >
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">{tr("Prozent (%)", "Percent (%)")}</SelectItem>
                <SelectItem value="amount">{tr("Betrag (€ netto)", "Amount (€ net)")}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={surcharge.value === 0 ? "" : String(surcharge.value)}
              placeholder="0"
              onChange={(e) => updateSurcharge({ mode: surcharge.mode, value: Number(e.target.value) || 0 })}
              className="h-10"
            />
            <span className="text-sm text-muted-foreground text-center">
              {surcharge.mode === "percent" ? "%" : "€"}
            </span>
          </div>
          {surchargeNet > 0 && (
            <div className="text-xs flex justify-between border-t border-border/60 pt-2">
              <span className="text-muted-foreground">{tr("Aufschlag (netto)", "Surcharge (net)")}</span>
              <span className="font-medium text-foreground">{fmt(surchargeNet)}</span>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-card border border-border p-4 shadow-soft space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm inline-flex items-center gap-1.5">
              <Calculator className="h-4 w-4 text-primary" /> {tr("Kalkulationsbasis", "Calculation basis")}
            </h3>
            <span className="text-xs text-muted-foreground">{tr("erscheint nicht im PDF", "not shown in PDF")}</span>
          </div>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tr("Kalkulierte Stunden", "Calculated hours")}</span>
              <span className="font-medium text-foreground">
                {Number(ai.estimated_hours || 0).toLocaleString(currentLocale(), { maximumFractionDigits: 1 })} {tr("Std", "hrs")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tr("Lohnkosten (netto)", "Labor cost (net)")}</span>
              <span className="font-medium text-foreground">{fmt(Number(p.labor_cost) || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tr("Material inkl. Aufschlag (netto)", "Materials incl. markup (net)")}</span>
              <span className="font-medium text-foreground">{fmt(Number(p.material_cost) || 0)}</span>
            </div>
            {Array.isArray(ai.sections) && ai.sections.length > 0 && ai.sections.some((s: any) => Number(s?.hours) > 0) && (
              <div className="border-t border-border/60 pt-2 mt-2 space-y-1">
                <div className="text-muted-foreground">{tr("Pro Bereich:", "Per section:")}</div>
                {ai.sections.map((s: any, i: number) => (
                  <div key={i} className="flex justify-between pl-2">
                    <span className="text-foreground">{s.title}</span>
                    <span className="text-muted-foreground">
                      {Number(s.hours || 0).toLocaleString(currentLocale(), { maximumFractionDigits: 1 })} {tr("Std", "hrs")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl gradient-primary text-primary-foreground p-5 shadow-elevated">
          <div className="flex justify-between text-sm mb-2"><span>{tr("Netto", "Net")}</span><span className="font-medium">{fmt(effNet)}</span></div>
          <div className="flex justify-between text-sm mb-3"><span>{tr("MwSt.", "VAT")} ({vatRate}%)</span><span className="font-medium">{fmt(effVat)}</span></div>
          <div className="border-t border-white/20 pt-3 flex justify-between items-baseline">
            <span className="font-semibold">{tr("Brutto", "Gross")}</span>
            <span className="text-2xl font-bold">{fmt(effGross)}</span>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm inline-flex items-center gap-1.5">
                {tr("Kundentext", "Customer text")}
                <span className="text-xs text-muted-foreground font-normal inline-flex items-center gap-1">
                  <Pencil className="h-3 w-3" /> {tr("bearbeitbar", "editable")}
                </span>
              </h3>
              <button onClick={copyText} className="text-xs text-primary font-medium inline-flex items-center gap-1 hover:underline">
                <Copy className="h-3.5 w-3.5" /> {tr("Kopieren", "Copy")}
              </button>
            </div>
            <Textarea
              value={customerDisplay}
              onChange={(e) => updateCustomerText(e.target.value)}
              className="min-h-[120px] text-sm leading-relaxed resize-y"
            />
          </div>
        </div>

        {pdfAllowed && (
          <Button onClick={() => downloadPDF()} disabled={busy} className="w-full h-12 gradient-primary text-primary-foreground border-0">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileDown className="h-4 w-4 mr-2" /> {tr("PDF jetzt erstellen", "Create PDF now")}</>}
          </Button>
        )}

        {pdfAllowed && (() => {
          const appLangIsEn = i18n.language?.toLowerCase().startsWith("en");
          const otherLang: "de" | "en" = appLangIsEn ? "de" : "en";
          const label = otherLang === "de"
            ? tr("PDF auf Deutsch erstellen", "Create PDF in German")
            : tr("PDF auf Englisch erstellen", "Create PDF in English");
          return (
            <Button
              onClick={() => downloadPDF(otherLang)}
              disabled={busy}
              variant="outline"
              className="w-full h-12"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileDown className="h-4 w-4 mr-2" /> {label}</>}
            </Button>
          );
        })()}

        {pdfAllowed && (
          <Button
            onClick={sendWhatsappDirect}
            disabled={busy}
            variant="outline"
            className="w-full h-12 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                <MessageCircle className="h-4 w-4 mr-2" /> {tr("Per WhatsApp senden", "Send via WhatsApp")}
                {!whatsappAllowed && (
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-primary/10 text-primary px-2 py-0.5">
                    {tr("Profi", "Pro")}
                  </span>
                )}
              </>
            )}
          </Button>
        )}

        {pdfAllowed && tier === "starter" && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">{tr("Mehr Wirkung mit Profi", "More impact with Pro")}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {tr(
                    "Dein PDF erscheint im Light-Tarif sauber mit deinen Firmen- und Adressdaten. Mit ",
                    "On the Light plan your PDF already looks clean with your company and address details. With ",
                  )}
                  <strong className="text-foreground">{tr("Profi", "Pro")}</strong>
                  {tr(" kommen dein eigenes Logo & deine Firmenfarben in den Briefkopf – und du kannst die PDF mit einem Tipp direkt per WhatsApp an den Kunden senden.", " your own logo and company colors appear in the letterhead — and you can send the PDF straight to your customer via WhatsApp with a single tap.")}
                </p>
              </div>
            </div>
            <Button onClick={() => nav("/pricing")} variant="outline" className="w-full h-10">
              {tr("Auf Profi upgraden", "Upgrade to Pro")}
            </Button>
          </div>
        )}

        {!pdfAllowed && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">{tr("PDF-Download im Light-Tarif", "PDF download on the Light plan")}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {tr("Wähle einen Tarif, um PDF-Angebote zu erstellen und herunterzuladen.", "Choose a plan to create and download PDF quotes.")}
                </p>
              </div>
            </div>
            <Button onClick={() => nav("/pricing")} className="w-full h-11 gradient-primary text-primary-foreground border-0">
              <Sparkles className="h-4 w-4 mr-2" /> {tr("Tarif wählen", "Choose plan")}
            </Button>
          </div>
        )}

        <Button onClick={() => save()} disabled={busy || saved} variant={saved ? "secondary" : "default"} className="w-full h-12">
          {saved ? <><Check className="h-4 w-4 mr-2" /> {tr("Gespeichert", "Saved")}</> : <><Save className="h-4 w-4 mr-2" /> {tr("Vorschlag speichern", "Save quote")}</>}
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
      <AlertDialog open={whatsappUpgradeOpen} onOpenChange={setWhatsappUpgradeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <AlertDialogTitle className="text-center">
              {tr("WhatsApp-Versand ist Profi-exklusiv", "WhatsApp sending is Pro-only")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center leading-relaxed">
              {tr("Mit dem ", "With the ")}<strong className="text-foreground">{tr("Profi", "Pro")}</strong>
              {tr("-Tarif sendest du deine Preisorientierung mit einem Tipp direkt per WhatsApp – inklusive persönlicher Anrede deines Kunden und der PDF als Anhang.", " plan you send your price estimate with a single tap directly via WhatsApp — including a personal greeting and the PDF attached.")}
              <br /><br />
              {tr("Im Light-Tarif lädst du das PDF einfach herunter und teilst es selbst.", "On the Light plan you just download the PDF and share it yourself.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-col sm:space-x-0 gap-2">
            <AlertDialogAction
              onClick={() => { setWhatsappUpgradeOpen(false); nav("/pricing"); }}
              className="w-full h-11 gradient-primary text-primary-foreground border-0"
            >
              <Sparkles className="h-4 w-4 mr-2" /> {tr("Auf Profi upgraden", "Upgrade to Pro")}
            </AlertDialogAction>
            <AlertDialogCancel className="w-full h-10 mt-0">
              {tr("Vielleicht später", "Maybe later")}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={addDlg.open} onOpenChange={(o) => setAddDlg((s) => ({ ...s, open: o }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tr("Position hinzufügen", "Add item")}</DialogTitle>
            <DialogDescription>
              {tr("Stunden, Stundensatz und Materialkosten werden direkt in die Kalkulation übernommen.", "Hours, hourly rate and material cost are added to the calculation directly.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-desc">{tr("Beschreibung", "Description")}</Label>
              <Textarea
                id="add-desc"
                value={addDlg.description}
                onChange={(e) => setAddDlg((s) => ({ ...s, description: e.target.value }))}
                placeholder={tr("z. B. Decke spachteln und streichen", "e.g. fill and paint ceiling")}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-hours">{tr("Stunden", "Hours")}</Label>
                <Input
                  id="add-hours"
                  type="number"
                  inputMode="decimal"
                  step="0.25"
                  min="0"
                  value={addDlg.hours}
                  onChange={(e) => setAddDlg((s) => ({ ...s, hours: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-material">{tr("Material netto (€)", "Materials net (€)")}</Label>
                <Input
                  id="add-material"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={addDlg.materialNet}
                  onChange={(e) => setAddDlg((s) => ({ ...s, materialNet: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Stundensatz", "Hourly rate")}</Label>
              {hourlyRates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {tr("Noch keine Stundensätze hinterlegt. Bitte unter Profil → Stundensätze pflegen.", "No hourly rates yet. Please set them under Profile → Hourly rates.")}
                </p>
              ) : (
                <Select
                  value={addDlg.rateId}
                  onValueChange={(v) => setAddDlg((s) => ({ ...s, rateId: v }))}
                >
                  <SelectTrigger><SelectValue placeholder={tr("Stundensatz wählen", "Pick hourly rate")} /></SelectTrigger>
                  <SelectContent>
                    {hourlyRates.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label} – {r.rate.toLocaleString(currentLocale())} €/{tr("Std", "hr")}{r.is_default ? ` (${tr("Standard", "default")})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {(() => {
              const h = Number((addDlg.hours || "0").replace(",", ".")) || 0;
              const m = Number((addDlg.materialNet || "0").replace(",", ".")) || 0;
              const r = hourlyRates.find((x) => x.id === addDlg.rateId)?.rate || 0;
              const labor = h * r;
              const markup = Number(settings?.material_markup ?? 15);
              const matGross = m * (1 + markup / 100);
              const net = labor + matGross;
              return (
                <div className="rounded-lg bg-secondary/40 p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">{tr("Lohn", "Labor")}</span><span>{fmt(labor)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{tr(`Material (inkl. ${markup}% Aufschlag)`, `Materials (incl. ${markup}% markup)`)}</span><span>{fmt(matGross)}</span></div>
                  <div className="flex justify-between font-semibold pt-1 border-t border-border/60"><span>{tr("Netto neue Position", "Net new item")}</span><span>{fmt(net)}</span></div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddDlg((s) => ({ ...s, open: false }))}>{tr("Abbrechen", "Cancel")}</Button>
            <Button onClick={confirmAddPosition}>
              <Plus className="h-4 w-4 mr-1.5" /> {tr("Hinzufügen", "Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
