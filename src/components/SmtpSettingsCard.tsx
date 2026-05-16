import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Mail, CheckCircle2, Trash2 } from "lucide-react";

interface Preset {
  label: string; host: string; port: number; secure: "ssl" | "starttls";
}
const PRESETS: Preset[] = [
  { label: "IONOS",        host: "smtp.ionos.de",       port: 465, secure: "ssl" },
  { label: "Strato",       host: "smtp.strato.de",      port: 465, secure: "ssl" },
  { label: "domainFACTORY / df.eu", host: "sslout.df.eu", port: 465, secure: "ssl" },
  { label: "GMX",          host: "mail.gmx.net",        port: 465, secure: "ssl" },
  { label: "Web.de",       host: "smtp.web.de",         port: 587, secure: "starttls" },
  { label: "Telekom / T-Online", host: "securesmtp.t-online.de", port: 465, secure: "ssl" },
  { label: "Gmail (App-Passwort)", host: "smtp.gmail.com", port: 465, secure: "ssl" },
  { label: "Outlook / Microsoft 365", host: "smtp.office365.com", port: 587, secure: "starttls" },
];

const getSmtpConfigError = (host: string, port: number, secure: "ssl" | "starttls" | "none") => {
  const normalizedHost = host.toLowerCase();
  if ([110, 143, 993, 995].includes(port)) {
    return "Port 993/995/143/110 ist für Posteingang. Für den Versand bitte SMTP nutzen – bei domainFACTORY/df.eu: sslout.df.eu, Port 465, SSL/TLS.";
  }
  if (normalizedHost.includes("df.eu") && port !== 465) return "Für domainFACTORY/df.eu bitte Port 465 mit SSL/TLS verwenden.";
  if (port === 465 && secure !== "ssl") return "Port 465 benötigt SSL/TLS.";
  if (port === 587 && secure !== "starttls") return "Port 587 benötigt STARTTLS.";
  return null;
};

export function SmtpSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [f, setF] = useState({
    fromName: "", fromEmail: "", host: "", port: 465,
    secure: "ssl" as "ssl" | "starttls" | "none",
    username: "", replyTo: "", password: "",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("user_settings").select(
        "smtp_from_name, smtp_from_email, smtp_host, smtp_port, smtp_secure, smtp_username, smtp_reply_to"
      ).maybeSingle();
      if (data) {
        setF((p) => ({
          ...p,
          fromName: (data as any).smtp_from_name || "",
          fromEmail: (data as any).smtp_from_email || "",
          host: (data as any).smtp_host || "",
          port: Number((data as any).smtp_port) || 465,
          secure: ((data as any).smtp_secure || "ssl") as any,
          username: (data as any).smtp_username || "",
          replyTo: (data as any).smtp_reply_to || "",
        }));
        setHasSavedPassword(!!(data as any).smtp_host);
      }
      setLoading(false);
    })();
  }, []);

  const applyPreset = (label: string) => {
    const p = PRESETS.find((x) => x.label === label);
    if (!p) return;
    setF((s) => ({ ...s, host: p.host, port: p.port, secure: p.secure }));
  };

  const save = async () => {
    if (!f.host || !f.port || !f.username || !f.fromEmail) {
      toast.error("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    if (!hasSavedPassword && !f.password) {
      toast.error("Bitte SMTP-Passwort angeben.");
      return;
    }
    const configError = getSmtpConfigError(f.host, f.port, f.secure);
    if (configError) { toast.error(configError); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("smtp-credentials", {
        body: {
          action: "save",
          host: f.host, port: f.port, secure: f.secure,
          username: f.username, fromEmail: f.fromEmail, fromName: f.fromName,
          replyTo: f.replyTo,
          password: f.password || undefined,
        },
      });
      if (error) throw error;
      const res = data as { ok?: boolean; error?: string; message?: string };
      if (!res?.ok) throw new Error(res?.message || res?.error || "Speichern fehlgeschlagen");
      toast.success("E-Mail-Versand gespeichert");
      setHasSavedPassword(true);
      setF((s) => ({ ...s, password: "" }));
    } catch (e: any) { toast.error(e.message || "Speichern fehlgeschlagen"); }
    finally { setBusy(false); }
  };

  const test = async () => {
    const configError = getSmtpConfigError(f.host, f.port, f.secure);
    if (configError) { toast.error(configError); return; }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("smtp-credentials", {
        body: {
          action: "save_and_test",
          host: f.host, port: f.port, secure: f.secure,
          username: f.username, fromEmail: f.fromEmail, fromName: f.fromName,
          replyTo: f.replyTo,
          password: f.password || undefined,
        },
      });
      if (error) throw error;
      const res = data as { ok?: boolean; error?: string; message?: string };
      if (!res?.ok) throw new Error(res?.message || res?.error || "Verbindung fehlgeschlagen");
      toast.success("Verbindung erfolgreich – Zugangsdaten gespeichert");
      setHasSavedPassword(true);
      setF((s) => ({ ...s, password: "" }));
    } catch (e: any) { toast.error(e.message || "Verbindung fehlgeschlagen"); }
    finally { setTesting(false); }
  };

  const remove = async () => {
    if (!confirm("E-Mail-Zugangsdaten wirklich löschen?")) return;
    setBusy(true);
    try {
      await supabase.functions.invoke("smtp-credentials", { body: { action: "delete" } });
      setF({ fromName: "", fromEmail: "", host: "", port: 465, secure: "ssl", username: "", replyTo: "", password: "" });
      setHasSavedPassword(false);
      toast.success("Zugangsdaten gelöscht");
    } finally { setBusy(false); }
  };

  if (loading) return null;

  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-soft space-y-4">
      <div className="flex items-start gap-3">
        <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold">E-Mail-Versand (eigene Adresse)</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Trage hier einmalig deine E-Mail-Zugangsdaten ein – wie in Outlook. PDFs werden dann
            direkt aus der App über deine eigene E-Mail-Adresse verschickt.
            {hasSavedPassword && (
              <span className="inline-flex items-center gap-1 ml-1 text-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> Eingerichtet
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Anbieter-Vorlage</Label>
        <Select onValueChange={applyPreset}>
          <SelectTrigger className="h-10"><SelectValue placeholder="Vorlage wählen (optional)" /></SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Absender-Name</Label>
          <Input value={f.fromName} onChange={(e) => setF({ ...f, fromName: e.target.value })}
            placeholder="Maler Müller GmbH" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label>Absender-E-Mail *</Label>
          <Input type="email" value={f.fromEmail}
            onChange={(e) => setF({ ...f, fromEmail: e.target.value })}
            placeholder="info@deinefirma.de" className="h-10" />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>SMTP-Server *</Label>
          <Input value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })}
            placeholder="smtp.ionos.de" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label>Port *</Label>
          <Input type="number" value={f.port}
            onChange={(e) => setF({ ...f, port: Number(e.target.value) || 0 })} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label>Verschlüsselung</Label>
          <Select value={f.secure} onValueChange={(v) => setF({ ...f, secure: v as any })}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ssl">SSL/TLS (Port 465)</SelectItem>
              <SelectItem value="starttls">STARTTLS (Port 587)</SelectItem>
              <SelectItem value="none">Keine</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Benutzername *</Label>
          <Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })}
            placeholder="Meist die E-Mail-Adresse" className="h-10" />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Passwort {hasSavedPassword && <span className="text-xs text-muted-foreground">(gespeichert – nur ändern wenn nötig)</span>}</Label>
          <Input type="password" value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            placeholder={hasSavedPassword ? "•••••••• (unverändert lassen)" : "SMTP-Passwort"} className="h-10" />
          <p className="text-[11px] text-muted-foreground">
            Bei Gmail: <strong>App-Passwort</strong> erstellen (nicht das normale Login-Passwort).
            Wird verschlüsselt gespeichert.
          </p>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Antwort-an (optional)</Label>
          <Input type="email" value={f.replyTo}
            onChange={(e) => setF({ ...f, replyTo: e.target.value })}
            placeholder="z. B. buero@deinefirma.de" className="h-10" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button onClick={save} disabled={busy} className="gradient-primary text-primary-foreground border-0">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Speichern"}
        </Button>
        <Button variant="outline" onClick={test} disabled={testing || !f.host || !f.username}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verbindung testen"}
        </Button>
        {hasSavedPassword && (
          <Button variant="ghost" onClick={remove} disabled={busy} className="text-destructive ml-auto">
            <Trash2 className="h-4 w-4 mr-1" /> Löschen
          </Button>
        )}
      </div>
    </div>
  );
}
