import { useNavigate } from "react-router-dom";
import { FileText, FolderOpen, Settings as SettingsIcon, Scale, User as UserIcon, LogOut, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Tile = ({ icon: Icon, title, subtitle, onClick, primary }: any) => (
  <button onClick={onClick}
    className={`w-full text-left rounded-2xl border p-5 transition-base shadow-soft hover:shadow-elevated active:scale-[0.99] ${
      primary ? "gradient-primary text-primary-foreground border-primary/30" : "bg-card border-border"
    }`}>
    <div className="flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${primary ? "bg-white/15" : "bg-secondary"}`}>
        <Icon className={`h-6 w-6 ${primary ? "text-white" : "text-primary"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-base ${primary ? "" : "text-foreground"}`}>{title}</div>
        {subtitle && <div className={`text-sm mt-0.5 ${primary ? "text-white/80" : "text-muted-foreground"}`}>{subtitle}</div>}
      </div>
    </div>
  </button>
);

export default function Home() {
  const nav = useNavigate();
  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
    nav("/auth");
  };
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <Logo size="sm" />
          <button onClick={logout} aria-label="Abmelden" className="p-2 rounded-full hover:bg-secondary transition-base">
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8 safe-bottom">
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 text-accent-foreground text-xs font-semibold mb-3">
            <Sparkles className="h-3.5 w-3.5" /> KI-gestützt
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Guten Tag.</h1>
          <p className="text-muted-foreground">Erstellen Sie in wenigen Minuten einen professionellen Preisvorschlag.</p>
        </div>

        <div className="space-y-3">
          <Tile primary icon={FileText} title="Preisvorschlag erstellen" subtitle="Beschreibung eingeben – KI strukturiert & kalkuliert" onClick={() => nav("/quote/new")} />
          <Tile icon={FolderOpen} title="Gespeicherte Vorschläge" subtitle="Frühere Kalkulationen ansehen" onClick={() => nav("/quotes")} />
          <Tile icon={UserIcon} title="Firmenprofil" subtitle="Firmendaten & Logo" onClick={() => nav("/profile")} />
          <Tile icon={SettingsIcon} title="Einstellungen" subtitle="Stundensatz, Aufschlag, Qualität" onClick={() => nav("/settings")} />
          <Tile icon={Scale} title="Rechtliches" subtitle="Impressum, Datenschutz, Haftung" onClick={() => nav("/legal")} />
        </div>
      </main>
    </div>
  );
}
