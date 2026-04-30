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
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </div>
  );

  const Sub = ({ children }: any) => (
    <h3 className="text-foreground font-medium text-sm mt-3 mb-1">{children}</h3>
  );

  const hasProfile = p?.company_name;

  return (
    <AppShell title="Rechtliches">
      <div className="space-y-4">
        {/* Impressum */}
        <Section title="Impressum">
          <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Angaben gemäß § 5 TMG</p>
          {hasProfile ? (
            <>
              <p className="text-foreground font-medium">{p.company_name}</p>
              {p.contact_person && <p>{p.contact_person}</p>}
              {p.address && <p className="whitespace-pre-line">{p.address}</p>}
              {(p.postal_code || p.city) && <p>{[p.postal_code, p.city].filter(Boolean).join(" ")}</p>}

              <Sub>Kontakt</Sub>
              {p.phone && <p>Telefon: {p.phone}</p>}
              {p.email && <p>E-Mail: {p.email}</p>}
              {p.website && <p>Web: {p.website}</p>}

              {p.vat_id && (
                <>
                  <Sub>Umsatzsteuer-ID</Sub>
                  <p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG: {p.vat_id}</p>
                </>
              )}

              <Sub>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</Sub>
              <p>{p.contact_person || p.company_name}{p.address ? `, ${p.address}` : ""}{p.city ? `, ${[p.postal_code, p.city].filter(Boolean).join(" ")}` : ""}</p>

              <Sub>Haftung für Inhalte</Sub>
              <p>Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen.</p>

              <Sub>Streitschlichtung</Sub>
              <p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
            </>
          ) : (
            <p className="italic">Bitte hinterlegen Sie Ihre Firmendaten im Profil. Sie werden hier automatisch übernommen.</p>
          )}
        </Section>

        {/* Datenschutz */}
        <Section title="Datenschutzerklärung">
          <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Information gemäß Art. 13 DSGVO</p>

          <Sub>1. Verantwortlicher</Sub>
          <p>Verantwortlich für die Datenverarbeitung ist der im Impressum genannte Betreiber.</p>

          <Sub>2. Zwecke und Rechtsgrundlagen der Verarbeitung</Sub>
          <p>Wir verarbeiten personenbezogene Daten ausschließlich zur Bereitstellung der App-Funktionen: Registrierung und Anmeldung, Verwaltung Ihres Firmenprofils, Erzeugung und Speicherung Ihrer Preisvorschläge sowie der zugehörigen Einstellungen.</p>
          <p>Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren, funktionsfähigen Dienst).</p>

          <Sub>3. Kategorien verarbeiteter Daten</Sub>
          <p>• Stammdaten: Firmenname, Ansprechpartner, Anschrift, USt-ID<br />
          • Kontaktdaten: E-Mail, Telefon, Webseite<br />
          • Nutzungsdaten: erstellte Preisvorschläge, hinterlegte Stundensätze und Einstellungen<br />
          • Anmeldedaten: E-Mail-Adresse, ggf. Profilinformationen aus Google-/Apple-Login</p>

          <Sub>4. Empfänger und Auftragsverarbeitung</Sub>
          <p>Zur Bereitstellung der App nutzen wir Infrastruktur-Dienstleister innerhalb der EU (Hosting, Datenbank, Authentifizierung). Mit diesen bestehen Verträge zur Auftragsverarbeitung gemäß Art. 28 DSGVO. Eine Weitergabe Ihrer Daten an Dritte zu Werbezwecken findet nicht statt.</p>

          <Sub>5. KI-gestützte Vorschlagserstellung</Sub>
          <p>Zur Erzeugung der Preisvorschläge werden Ihre Texteingaben an einen KI-Dienst (innerhalb der EU/EWR betrieben) übermittelt. Es werden keine personenbezogenen Kundendaten benötigt – geben Sie daher keine Klarnamen oder Kontaktdaten von Endkunden in die Beschreibung ein.</p>

          <Sub>6. Speicherdauer</Sub>
          <p>Wir speichern Ihre Daten, solange Ihr Konto besteht. Auf Wunsch werden Konto und alle zugehörigen Daten unverzüglich gelöscht. Gesetzliche Aufbewahrungsfristen bleiben unberührt.</p>

          <Sub>7. Ihre Rechte</Sub>
          <p>Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) sowie Widerspruch (Art. 21 DSGVO). Wenden Sie sich hierzu an die im Impressum genannte Kontaktadresse.</p>

          <Sub>8. Beschwerderecht</Sub>
          <p>Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, insbesondere am Ort Ihres Aufenthalts oder der mutmaßlichen Verletzung.</p>

          <Sub>9. Datensicherheit</Sub>
          <p>Die Übertragung erfolgt verschlüsselt (TLS). Die Speicherung erfolgt auf gesicherten Servern innerhalb der Europäischen Union. Der Zugriff auf Ihre Daten ist durch ein individuelles Berechtigungssystem geschützt.</p>
        </Section>

        {/* Haftung */}
        <Section title="Haftungshinweis Preisvorschläge">
          <p>Die in dieser App erzeugten Preisvorschläge dienen ausschließlich als unverbindliche Orientierung auf Basis der von Ihnen gemachten Angaben. Sie stellen kein verbindliches Angebot dar und ersetzen keine individuelle fachliche Prüfung vor Ort. Eine Haftung für die Richtigkeit, Vollständigkeit oder Wirtschaftlichkeit der berechneten Werte ist ausgeschlossen.</p>
        </Section>
      </div>
    </AppShell>
  );
}
