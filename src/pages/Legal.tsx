import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export default function Legal() {
  const [p, setP] = useState<any>(null);
  useEffect(() => {
    supabase.from("profiles").select("*").maybeSingle().then(({ data }) => setP(data));
  }, []);

  const Section = ({ title, children }: any) => (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
      <h2 className="font-semibold text-base mb-3">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-1.5">{children}</div>
    </div>
  );

  return (
    <AppShell title="Rechtliches">
      <div className="space-y-4">
        <Section title="Impressum">
          {p?.company_name && <p className="text-foreground font-medium">{p.company_name}</p>}
          {p?.contact_person && <p>{p.contact_person}</p>}
          {p?.address && <p className="whitespace-pre-line">{p.address}</p>}
          {p?.phone && <p>Tel: {p.phone}</p>}
          {p?.email && <p>E-Mail: {p.email}</p>}
          {!p?.company_name && <p className="italic">Bitte hinterlegen Sie Ihre Firmendaten im Profil.</p>}
        </Section>

        <Section title="Datenschutz (Kurzform)">
          <p>Diese App verarbeitet personenbezogene Daten ausschließlich zur Bereitstellung der Funktionen (Anmeldung, Profil, Speicherung Ihrer Vorschläge).</p>
          <p>Eine Weitergabe an Dritte erfolgt nicht. Daten werden auf gesicherten Servern in der EU gespeichert.</p>
          <p>Sie können Ihr Konto und alle zugehörigen Daten jederzeit löschen lassen.</p>
        </Section>

        <Section title="Haftungshinweis">
          <p>Die erzeugten Preisvorschläge dienen ausschließlich als unverbindliche Orientierung und ersetzen keine individuelle fachliche Prüfung.</p>
        </Section>
      </div>
    </AppShell>
  );
}
