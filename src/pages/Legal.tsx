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

        {/* Nutzungsbedingungen / AGB */}
        <Section title="Nutzungsbedingungen">
          <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Allgemeine Geschäftsbedingungen für die Nutzung der App</p>

          <Sub>1. Geltungsbereich</Sub>
          <p>Diese Nutzungsbedingungen regeln die Nutzung der App „Malerzeit" (nachfolgend „App") durch registrierte Nutzer. Mit der Registrierung erkennst du diese Bedingungen als verbindlich an.</p>

          <Sub>2. Leistungsbeschreibung</Sub>
          <p>Die App stellt dir ein Werkzeug zur Verfügung, mit dem du auf Basis deiner Eingaben (Tätigkeitsbeschreibung, Stundensätze, Aufschläge, Qualitätsniveau) automatisiert Preisvorschläge erzeugen, speichern und als PDF exportieren kannst. Die Berechnung erfolgt unter Einsatz künstlicher Intelligenz.</p>

          <Sub>3. Registrierung und Konto</Sub>
          <p>Für die Nutzung ist ein Nutzerkonto erforderlich. Du bist verpflichtet, bei der Registrierung wahrheitsgemäße Angaben zu machen und deine Zugangsdaten vertraulich zu behandeln. Eine Weitergabe des Kontos an Dritte ist nicht gestattet.</p>

          <Sub>4. Pflichten des Nutzers</Sub>
          <p>Du verpflichtest dich, die App nicht missbräuchlich zu nutzen, insbesondere keine rechtswidrigen Inhalte einzugeben und keine personenbezogenen Daten Dritter (insb. deiner Endkunden) ohne Notwendigkeit in Freitextfelder einzugeben. Die im Firmenprofil hinterlegten Daten erscheinen auf deinen erstellten PDF-Angeboten und im in der App angezeigten Impressum – die Richtigkeit liegt in deiner Verantwortung.</p>

          <Sub>5. Preisvorschläge – Unverbindlichkeit</Sub>
          <p>Die durch die App erzeugten Preisvorschläge sind <strong>unverbindliche Kalkulationshilfen</strong> und stellen kein rechtsverbindliches Angebot dar. Sie ersetzen keine individuelle fachliche Prüfung vor Ort. Für die Richtigkeit, Vollständigkeit und wirtschaftliche Tragfähigkeit der Vorschläge übernimmt der Anbieter keine Gewähr.</p>

          <Sub>6. Verfügbarkeit</Sub>
          <p>Es besteht kein Anspruch auf eine ununterbrochene Verfügbarkeit der App. Wartungsarbeiten, technische Störungen oder Anpassungen können zu vorübergehenden Einschränkungen führen.</p>

          <Sub>7. Haftung</Sub>
          <p>Der Anbieter haftet unbeschränkt für Schäden aus Verletzung des Lebens, des Körpers oder der Gesundheit sowie für Schäden, die auf vorsätzlichem oder grob fahrlässigem Verhalten beruhen. Im Übrigen ist die Haftung – soweit gesetzlich zulässig – auf den vertragstypisch vorhersehbaren Schaden begrenzt. Eine Haftung für Folgeschäden, die aus der Verwendung der erzeugten Preisvorschläge entstehen, ist ausgeschlossen.</p>

          <Sub>8. Nutzungsrechte an Inhalten</Sub>
          <p>Die von dir eingegebenen Daten und erzeugten Preisvorschläge bleiben dein Eigentum. Du räumst dem Anbieter lediglich die zur Bereitstellung des Dienstes notwendigen Nutzungsrechte ein (Speicherung, Verarbeitung, Anzeige in deinem Konto).</p>

          <Sub>9. Kündigung</Sub>
          <p>Du kannst dein Konto jederzeit ohne Angabe von Gründen löschen lassen. Mit der Löschung werden deine in der App gespeicherten Daten unwiderruflich entfernt, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</p>

          <Sub>10. Änderungen der Nutzungsbedingungen</Sub>
          <p>Der Anbieter behält sich vor, diese Nutzungsbedingungen anzupassen, soweit dies aus rechtlichen, technischen oder organisatorischen Gründen erforderlich wird. Du wirst über wesentliche Änderungen rechtzeitig in geeigneter Form informiert.</p>

          <Sub>11. Schlussbestimmungen</Sub>
          <p>Es gilt deutsches Recht. Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Regelungen unberührt.</p>
        </Section>

        {/* Haftung */}
        <Section title="Haftungshinweis Preisvorschläge">
          <p>Die in dieser App erzeugten Preisvorschläge dienen ausschließlich als unverbindliche Orientierung auf Basis der von dir gemachten Angaben. Sie stellen kein verbindliches Angebot dar und ersetzen keine individuelle fachliche Prüfung vor Ort. Eine Haftung für die Richtigkeit, Vollständigkeit oder Wirtschaftlichkeit der berechneten Werte ist ausgeschlossen.</p>
        </Section>
      </div>
    </AppShell>
  );
}
