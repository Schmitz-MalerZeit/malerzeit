import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { z } from "zod";
import { useTranslation } from "react-i18next";

const schema = z.object({
  email: z.string().trim().email("Ungültige E-Mail").max(255),
  password: z.string().min(6, "Mindestens 6 Zeichen").max(100),
});

export default function Auth() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        // Email-Bestätigung ist Pflicht – ohne Session muss der User erst die Mail bestätigen
        if (!data.session) {
          toast.success("Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir gerade gesendet haben.");
          setMode("signin");
          setPassword("");
        } else {
          toast.success("Konto erstellt – willkommen!");
          nav("/");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message?.toLowerCase().includes("email not confirmed")) {
            toast.error("Bitte bestätige zuerst deine E-Mail-Adresse. Schau in dein Postfach (auch Spam).");
          } else {
            throw error;
          }
        } else {
          nav("/");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Anmeldung fehlgeschlagen");
    } finally { setLoading(false); }
  };

  const oauth = async (provider: "google" | "apple") => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
      if (result.redirected) return;
      nav("/");
    } catch (err: any) {
      toast.error(err?.message || `${provider} Anmeldung nicht verfügbar`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher variant="compact" />
      </div>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Logo size="lg" />
          <p className="text-sm text-muted-foreground mt-3">{t("auth.subtitle")}</p>
        </div>

        <div className="bg-card rounded-2xl shadow-elevated p-6 border border-border">
          <div className="flex gap-1 mb-6 p-1 bg-secondary rounded-xl">
            <button onClick={() => setMode("signin")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-base ${mode === "signin" ? "bg-card shadow-soft text-foreground" : "text-muted-foreground"}`}>
              {t("auth.tabSignIn")}
            </button>
            <button onClick={() => setMode("signup")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-base ${mode === "signup" ? "bg-card shadow-soft text-foreground" : "text-muted-foreground"}`}>
              {t("auth.tabSignUp")}
            </button>
          </div>

          <div className="space-y-3 mb-5">
            <Button type="button" variant="outline" className="w-full h-12 font-medium" onClick={() => oauth("google")} disabled={loading}>
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              {t("auth.google")}
            </Button>
            <Button type="button" variant="outline" className="w-full h-12 font-medium" onClick={() => oauth("apple")} disabled={loading}>
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              {t("auth.apple")}
            </Button>
          </div>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground uppercase tracking-wider">{t("auth.continueWith")}</span></div>
          </div>

          <form onSubmit={handleEmail} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} className="h-12" placeholder="name@firma.de" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" placeholder="••••••••" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold gradient-primary text-primary-foreground border-0 shadow-soft hover:shadow-glow transition-base">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Mail className="h-4 w-4 mr-2" /> {mode === "signin" ? t("auth.signIn") : t("auth.signUp")}</>}
            </Button>
          </form>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-6 leading-relaxed">
          Mit der Anmeldung akzeptieren Sie unsere <a href="/terms" className="underline">Nutzungsbedingungen</a> und <a href="/privacy" className="underline">Datenschutzhinweise</a>.
        </p>

        <nav aria-label="Rechtliches" className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <a href="/pricing" className="underline hover:text-foreground">Tarife & Preise</a>
          <a href="/imprint" className="underline hover:text-foreground">Impressum</a>
          <a href="/terms" className="underline hover:text-foreground">Nutzungsbedingungen</a>
          <a href="/privacy" className="underline hover:text-foreground">Datenschutz</a>
          <a href="/refund" className="underline hover:text-foreground">Widerruf & Rückerstattung</a>
        </nav>
        <p className="text-[11px] text-center text-muted-foreground mt-3">Anbieter: Raumwerk Schmitz</p>
      </div>
    </div>
  );
}
