import { useEffect, useState } from "react";
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

const VOICE_FIELDS = new Set(["company_name", "contact_person", "address", "city"]);
const appendText = (prev: string, add: string) =>
  prev.trim().length === 0 ? add : `${prev.replace(/\s+$/, "")} ${add}`;

const FIELDS: { k: string; l: string; type?: string; hint?: string }[] = [
  { k: "company_name", l: "Firma" },
  { k: "contact_person", l: "Inhaber / Ansprechpartner (optional)" },
  {
    k: "signatory_name",
    l: "Zeichnungsberechtigte Person (optional)",
    hint: "Diese Person erscheint am Ende jeder Preisorientierung unter „Mit freundlichen Grüßen“ – darunter automatisch der Firmenname. Praktisch, wenn z. B. ein Vorarbeiter im Auftrag des Betriebs unterzeichnet. Bleibt das Feld leer, wird der Inhaber bzw. der Firmenname verwendet.",
  },
  { k: "address", l: "Straße & Hausnummer" },
  { k: "address_line2", l: "Adresszusatz (z. B. Gebäude B, c/o, 2. OG)" },
  { k: "postal_code", l: "Postleitzahl" },
  { k: "city", l: "Ort" },
  { k: "phone", l: "Telefon", type: "tel" },
  { k: "email", l: "E-Mail", type: "email" },
  { k: "website", l: "Webseite", type: "url" },
  { k: "vat_id", l: "Umsatzsteuer-ID" },
];

export default function Profile() {
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
      if (!u.user) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("profiles").update(p as any).eq("id", u.user.id);
      if (error) throw error;
      toast.success("Profil gespeichert");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Nicht angemeldet");

      // Defensive Validierung BEFORE Upload, damit defekte Dateien gar nicht erst
      // im Storage landen und später die PDF-Pipeline torpedieren.
      if (!file.type.startsWith("image/")) {
        throw new Error("Nur Bilddateien werden unterstützt (PNG, JPG, WEBP, SVG).");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Logo ist zu groß (max. 5 MB).");
      }

      // Endung sicher ableiten – fallback auf "png" für Mime-Types ohne klare Extension.
      const rawExt = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
      const ext = /^(png|jpe?g|webp|svg|gif|avif)$/.test(rawExt) ? rawExt : "png";
      const path = `${u.user.id}/logo.${ext}`;
      const { error } = await supabase.storage.from("company-logos").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("company-logos").getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;

      // Color-Extraction kann bei SVG/CORS-Problemen scheitern – wir behandeln
      // das als nicht-fatalen Fehler und behalten dann die bisherigen Farben bei.
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
          ? "Logo hochgeladen – SVGs werden automatisch fürs PDF rasterisiert."
          : "Logo hochgeladen – PDF passt sich an"
      );
    } catch (e: any) {
      toast.error(e.message || "Logo-Upload fehlgeschlagen");
    }
    finally { setUploading(false); }
  };

  if (loading) return <AppShell title="Firmenprofil"><div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;

  return (
    <AppShell title="Firmenprofil">
      <div className="space-y-5">
        <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
          <Label className="text-sm font-medium">Firmenlogo</Label>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Erscheint im PDF-Briefkopf. PDF-Download ist ab dem <strong className="text-foreground">Profi</strong>-Tarif verfügbar.
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
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /> Logo hochladen</>}
              </div>
            </label>
          </div>
          <div className="mt-5 pt-4 border-t border-border">
            <div className="flex items-center justify-between gap-2 mb-2">
              <Label className="text-sm font-medium">PDF-Farbe</Label>
              {p.logo_url && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const c = await extractDominantColors(p.logo_url);
                      setP((prev) => ({ ...prev, logo_primary_color: c.primary, logo_secondary_color: c.secondary }));
                      toast.success("Farbe aus Logo neu abgeleitet");
                    } catch { toast.error("Konnte Farbe nicht ableiten"); }
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Aus Logo ableiten
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Wird automatisch aus dem Logo abgeleitet (sanft, professionell). Du kannst sie jederzeit gegen einen kuratierten Profi-Ton tauschen.
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
                <span>Aktuell:</span>
                <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: p.logo_primary_color }} />
                <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: p.logo_secondary_color }} />
              </div>
            )}
          </div>

          {showPdfPreview && (
            <div className="mt-5 pt-5 border-t border-border">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">PDF-Vorschau (Briefkopf)</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                So erscheinen Logo, Farben und Firmendaten oben auf jedem Angebots-PDF. Änderungen werden sofort übernommen.
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
                  <VoiceInput size="md" label={`${l} diktieren`}
                    onTranscript={(t) => setP((prev) => ({ ...prev, [k]: appendText(prev[k] || "", t) }))} />
                )}
              </div>
              {hint && <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>}
            </div>
          ))}
        </div>

        <Button onClick={save} disabled={saving} className="w-full h-12 gradient-primary text-primary-foreground border-0 font-semibold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Speichern"}
        </Button>

        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 mt-8">
          <h3 className="font-semibold text-destructive mb-1 flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Konto löschen
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Löscht dein Konto, alle Angebote, PDFs, dein Profil und Einstellungen unwiderruflich.
            Aktive Abonnements werden vorher gekündigt.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full h-11">
                Konto endgültig löschen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Konto endgültig löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Diese Aktion kann nicht rückgängig gemacht werden. Alle deine Daten werden sofort gelöscht
                  und ein eventuell aktives Abo wird gekündigt. Tippe <strong>LÖSCHEN</strong> zum Bestätigen.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="LÖSCHEN"
                className="h-11"
              />
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmText("")}>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  disabled={confirmText !== "LÖSCHEN" || deleting}
                  onClick={async (e) => {
                    e.preventDefault();
                    setDeleting(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("delete-account");
                      if (error || data?.error) throw new Error(error?.message || data?.error);
                      await supabase.auth.signOut();
                      toast.success("Konto gelöscht");
                      nav("/auth", { replace: true });
                    } catch (err: any) {
                      toast.error(err.message || "Löschung fehlgeschlagen");
                      setDeleting(false);
                    }
                  }}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Endgültig löschen"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </AppShell>
  );
}
