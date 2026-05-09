import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload, ImageIcon, Eye, Trash2 } from "lucide-react";
import { extractDominantColors, PDF_COLOR_PALETTE } from "@/lib/colorExtractor";
import { VoiceInput } from "@/components/VoiceInput";
import { LetterheadPreview } from "@/components/LetterheadPreview";
import { useSubscription } from "@/hooks/useSubscription";
import { canUseLogoInPdf, getTier } from "@/lib/planFeatures";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { useTr } from "@/lib/tr";
import { FirstVisitTip } from "@/components/FirstVisitTip";

const VOICE_FIELDS = new Set(["company_name", "contact_person", "address", "city"]);
const appendText = (prev: string, add: string) =>
  prev.trim().length === 0 ? add : `${prev.replace(/\s+$/, "")} ${add}`;

export default function Profile() {
  const tr = useTr();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const nav = useNavigate();
  const subState = useSubscription();
  const tier = getTier(subState);
  const showPdfPreview = canUseLogoInPdf(tier);
  const [p, setP] = useState<Record<string, string>>({
    company_name: "", contact_person: "", signatory_name: "", address: "", address_line2: "", postal_code: "", city: "",
    phone: "", email: "", website: "", vat_id: "",
    logo_url: "", logo_primary_color: "", logo_secondary_color: "",
  });

  const FIELDS: { k: string; l: string; type?: string; hint?: string }[] = useMemo(() => [
    { k: "company_name", l: tr("Firma", "Company") },
    { k: "contact_person", l: tr("Inhaber / Ansprechpartner (optional)", "Owner / contact person (optional)") },
    {
      k: "signatory_name",
      l: tr("Zeichnungsberechtigte Person (optional)", "Authorized signatory (optional)"),
      hint: tr(
        "Diese Person erscheint am Ende jeder Preisorientierung unter „Mit freundlichen Grüßen“ – darunter automatisch der Firmenname. Praktisch, wenn z. B. ein Vorarbeiter im Auftrag des Betriebs unterzeichnet. Bleibt das Feld leer, wird der Inhaber bzw. der Firmenname verwendet.",
        "This person appears at the end of every price estimate under \"Kind regards\" — followed automatically by the company name. Useful if e.g. a foreman signs on behalf of the company. If left empty, the owner or company name is used.",
      ),
    },
    { k: "address", l: tr("Straße & Hausnummer", "Street & house number") },
    { k: "address_line2", l: tr("Adresszusatz (z. B. Gebäude B, c/o, 2. OG)", "Address line 2 (e.g. building B, c/o, 2nd floor)") },
    { k: "postal_code", l: tr("Postleitzahl", "Postal code") },
    { k: "city", l: tr("Ort", "City") },
    { k: "phone", l: tr("Telefon", "Phone"), type: "tel" },
    { k: "email", l: tr("E-Mail", "Email"), type: "email" },
    { k: "website", l: tr("Webseite", "Website"), type: "url" },
    { k: "vat_id", l: tr("Umsatzsteuer-ID", "VAT ID") },
  ], [tr]);

  useEffect(() => {
    supabase.from("profiles").select("*").maybeSingle().then(({ data }) => {
      if (data) {
        const next: Record<string, string> = { ...p };
        Object.keys(next).forEach(k => { next[k] = (data as any)[k] || ""; });
        setP(next);
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(tr("Nicht angemeldet", "Not signed in"));
      const { error } = await supabase.from("profiles").update(p as any).eq("id", u.user.id);
      if (error) throw error;
      toast.success(tr("Profil gespeichert", "Profile saved"));
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(tr("Nicht angemeldet", "Not signed in"));

      if (!file.type.startsWith("image/")) {
        throw new Error(tr("Nur Bilddateien werden unterstützt (PNG, JPG, WEBP, SVG).", "Only image files are supported (PNG, JPG, WEBP, SVG)."));
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error(tr("Logo ist zu groß (max. 5 MB).", "Logo is too large (max. 5 MB)."));
      }

      const rawExt = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
      const ext = /^(png|jpe?g|webp|svg|gif|avif)$/.test(rawExt) ? rawExt : "png";
      const path = `${u.user.id}/logo.${ext}`;
      const { error } = await supabase.storage.from("company-logos").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("company-logos").getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;

      let colors = { primary: p.logo_primary_color || "", secondary: p.logo_secondary_color || "" };
      try {
        const extracted = await extractDominantColors(url);
        if (extracted?.primary) colors = extracted;
      } catch (colorErr) {
        console.warn("color extraction failed, keeping previous colors", colorErr);
      }

      const next = { ...p, logo_url: url, logo_primary_color: colors.primary, logo_secondary_color: colors.secondary };
      setP(next);
      await supabase.from("profiles").update(next as any).eq("id", u.user.id);
      const isVector = ext === "svg";
      toast.success(
        isVector
          ? tr("Logo hochgeladen – SVGs werden automatisch fürs PDF rasterisiert.", "Logo uploaded — SVGs are automatically rasterized for the PDF.")
          : tr("Logo hochgeladen – PDF passt sich an", "Logo uploaded — PDF will adapt"),
      );
    } catch (e: any) {
      toast.error(e.message || tr("Logo-Upload fehlgeschlagen", "Logo upload failed"));
    }
    finally { setUploading(false); }
  };

  const title = tr("Firmenprofil", "Company profile");
  if (loading) return <AppShell title={title}><div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;

  return (
    <AppShell title={title}>
      <FirstVisitTip
        storageKey="profile"
        title={tr("Tipps zum Firmenprofil", "Company profile tips")}
      >
        <p>{tr(
          "Diese Daten erscheinen im Briefkopf jedes PDFs. Achte besonders auf den Firmennamen, die Adresse und das Logo.",
          "These details appear in the letterhead of every PDF. Pay special attention to the company name, address and logo.",
        )}</p>
        <p>{tr(
          "Der Unterzeichner-Name wird unter jedes Angebot gesetzt – ideal für die persönliche Note.",
          "The signatory name is added under every quote – ideal for a personal touch.",
        )}</p>
        <p>{tr(
          "Bankverbindung & Steuernummer einmal sauber pflegen – sie werden automatisch in jedes PDF übernommen.",
          "Set bank details and tax number once – they are added to every PDF automatically.",
        )}</p>
      </FirstVisitTip>
      <div className="space-y-5">
        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
          <Label className="text-sm font-medium">{tr("Firmenlogo", "Company logo")}</Label>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            {tr("Erscheint im PDF-Briefkopf. PDF-Download ist ab dem ", "Appears in the PDF letterhead. PDF download is available from the ")}
            <strong className="text-foreground">{tr("Profi", "Pro")}</strong>
            {tr("-Tarif verfügbar.", " plan.")}
          </p>
          <div className="flex items-center gap-4 mt-3">
            <div className="h-20 w-20 rounded-xl bg-secondary flex items-center justify-center overflow-hidden border border-border">
              {p.logo_url ? <img src={p.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
            </div>
            <label className="flex-1">
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
              <div className="h-12 px-4 rounded-xl border border-input bg-background flex items-center justify-center gap-2 cursor-pointer hover:bg-secondary transition-base text-sm font-medium">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /> {tr("Logo hochladen", "Upload logo")}</>}
              </div>
            </label>
          </div>
          <div className="mt-5 pt-4 border-t border-border">
            <div className="flex items-center justify-between gap-2 mb-2">
              <Label className="text-sm font-medium">{tr("PDF-Farbe", "PDF color")}</Label>
              {p.logo_url && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const c = await extractDominantColors(p.logo_url);
                      setP((prev) => ({ ...prev, logo_primary_color: c.primary, logo_secondary_color: c.secondary }));
                      toast.success(tr("Farbe aus Logo neu abgeleitet", "Color re-extracted from logo"));
                    } catch { toast.error(tr("Konnte Farbe nicht ableiten", "Could not extract color")); }
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  {tr("Aus Logo ableiten", "Extract from logo")}
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {tr(
                "Wird automatisch aus dem Logo abgeleitet (sanft, professionell). Du kannst sie jederzeit gegen einen kuratierten Profi-Ton tauschen.",
                "Automatically derived from your logo (soft, professional). You can switch to a curated pro tone any time.",
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {PDF_COLOR_PALETTE.map((sw) => {
                const active = (p.logo_primary_color || "").toLowerCase() === sw.primary.toLowerCase();
                return (
                  <button
                    key={sw.id}
                    type="button"
                    title={sw.label}
                    aria-label={sw.label}
                    onClick={() => setP({ ...p, logo_primary_color: sw.primary, logo_secondary_color: sw.secondary })}
                    className={`h-9 w-9 rounded-full border-2 transition-base ${active ? "border-foreground scale-110" : "border-border hover:border-foreground/40"}`}
                    style={{ backgroundColor: sw.primary }}
                  />
                );
              })}
            </div>
            {p.logo_primary_color && (
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <span>{tr("Aktuell:", "Current:")}</span>
                <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: p.logo_primary_color }} />
                <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: p.logo_secondary_color }} />
              </div>
            )}
          </div>

          {showPdfPreview && (
            <div className="mt-5 pt-5 border-t border-border">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{tr("PDF-Vorschau (Briefkopf)", "PDF preview (letterhead)")}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {tr(
                  "So erscheinen Logo, Farben und Firmendaten oben auf jedem Angebots-PDF. Änderungen werden sofort übernommen.",
                  "This is how your logo, colors and company details appear at the top of every quote PDF. Changes apply instantly.",
                )}
              </p>
              <LetterheadPreview
                companyName={p.company_name}
                contact={p.contact_person}
                address={p.address}
                addressLine2={p.address_line2}
                postalCode={p.postal_code}
                city={p.city}
                phone={p.phone}
                email={p.email}
                website={p.website}
                logoUrl={p.logo_url}
                primaryColor={p.logo_primary_color}
                secondaryColor={p.logo_secondary_color}
              />
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft space-y-4">
          {FIELDS.map(({ k, l, type, hint }) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={k}>{l}</Label>
              <div className="flex gap-2">
                <Input id={k} type={type || "text"} value={p[k] || ""}
                  onChange={(e) => setP({ ...p, [k]: e.target.value })}
                  className="h-11 flex-1" />
                {VOICE_FIELDS.has(k) && (
                  <VoiceInput size="md" label={tr(`${l} diktieren`, `Dictate ${l}`)}
                    onTranscript={(t) => setP((prev) => ({ ...prev, [k]: appendText(prev[k] || "", t) }))} />
                )}
              </div>
              {hint && <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>}
            </div>
          ))}
        </div>

        <Button onClick={save} disabled={saving} className="w-full h-12 gradient-primary text-primary-foreground border-0 font-semibold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Speichern", "Save")}
        </Button>

        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 mt-8">
          <h3 className="font-semibold text-destructive mb-1 flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> {tr("Konto löschen", "Delete account")}
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            {tr(
              "Löscht dein Konto, alle Angebote, PDFs, dein Profil und Einstellungen unwiderruflich. Aktive Abonnements werden vorher gekündigt.",
              "Permanently deletes your account, all quotes, PDFs, your profile and settings. Active subscriptions are cancelled first.",
            )}
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full h-11">
                {tr("Konto endgültig löschen", "Delete account permanently")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{tr("Konto endgültig löschen?", "Delete account permanently?")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {tr(
                    "Diese Aktion kann nicht rückgängig gemacht werden. Alle deine Daten werden sofort gelöscht und ein eventuell aktives Abo wird gekündigt. Tippe ",
                    "This action cannot be undone. All your data will be deleted immediately and any active subscription will be cancelled. Type ",
                  )}
                  <strong>{tr("LÖSCHEN", "DELETE")}</strong>
                  {tr(" zum Bestätigen.", " to confirm.")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={tr("LÖSCHEN", "DELETE")}
                className="h-11"
              />
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmText("")}>{tr("Abbrechen", "Cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  disabled={confirmText !== tr("LÖSCHEN", "DELETE") || deleting}
                  onClick={async (e) => {
                    e.preventDefault();
                    setDeleting(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("delete-account");
                      if (error || data?.error) throw new Error(error?.message || data?.error);
                      await supabase.auth.signOut();
                      toast.success(tr("Konto gelöscht", "Account deleted"));
                      nav("/auth", { replace: true });
                    } catch (err: any) {
                      toast.error(err.message || tr("Löschung fehlgeschlagen", "Deletion failed"));
                      setDeleting(false);
                    }
                  }}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Endgültig löschen", "Delete permanently")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </AppShell>
  );
}
