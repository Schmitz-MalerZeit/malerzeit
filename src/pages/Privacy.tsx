import { PublicShell } from "@/components/PublicShell";

export default function Privacy() {
  return (
    <PublicShell title="Datenschutzerklärung">
      <p className="text-xs uppercase tracking-wide text-muted-foreground/70">
        Information gemäß Art. 13 DSGVO
      </p>
      <p className="text-xs text-muted-foreground">Stand: Mai 2026</p>

      <h2>1. Verantwortlicher</h2>
      <p>
        Verantwortlich im Sinne der DSGVO ist:
      </p>
      <p>
        Christoph Schmitz, Einzelunternehmer<br />
        Raumwerk Schmitz<br />
        Meirehmer Berg 10<br />
        29664 Walsrode<br />
        Deutschland<br />
        E-Mail: support@schmitz-walsrode.de<br />
        Telefon: 05161 9491315<br />
        USt-IdNr.: DE260741375
      </p>

      <h2>2. Zwecke und Rechtsgrundlagen der Verarbeitung</h2>
      <p>
        Wir verarbeiten personenbezogene Daten ausschließlich zur Bereitstellung der
        App-Funktionen: Registrierung und Anmeldung, Verwaltung des Firmenprofils,
        Erzeugung und Speicherung von Preisorientierungen, Abwicklung von Abonnements
        sowie Support.
      </p>
      <p>
        Rechtsgrundlagen sind Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung), Art. 6 Abs. 1
        lit. c DSGVO (rechtliche Verpflichtungen, z. B. steuerrechtliche Aufbewahrung) und
        Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren,
        funktionsfähigen Dienst sowie an der Missbrauchsprävention).
      </p>

      <h2>3. Kategorien verarbeiteter Daten</h2>
      <ul>
        <li><strong>Stammdaten:</strong> Firmenname, Ansprechpartner, Anschrift, USt-IdNr.</li>
        <li><strong>Kontaktdaten:</strong> E-Mail, Telefon, Webseite</li>
        <li><strong>Anmeldedaten:</strong> E-Mail-Adresse, Passwort-Hash, ggf. Profilinformationen aus Google-Login</li>
        <li><strong>Nutzungsdaten:</strong> erstellte Preisvorschläge, hinterlegte Stundensätze und Einstellungen</li>
        <li><strong>Abonnement-/Zahlungsdaten:</strong> Abonnement-Status, Tarif, Laufzeit, Rechnungs-IDs (die eigentliche Zahlungsabwicklung erfolgt durch Paddle, siehe Ziffer 5)</li>
        <li><strong>Technische Daten:</strong> IP-Adresse, Geräte- und Browserinformationen, Logdaten zur Sicherstellung der IT-Sicherheit</li>
      </ul>

      <h2>4. Empfänger und Auftragsverarbeitung</h2>
      <p>
        Zur Bereitstellung der App nutzen wir Infrastruktur-Dienstleister (Hosting,
        Datenbank, Authentifizierung, KI-Verarbeitung). Mit diesen bestehen Verträge zur
        Auftragsverarbeitung gemäß Art. 28 DSGVO. Eine Weitergabe deiner Daten an Dritte
        zu Werbezwecken findet nicht statt. Empfängerkategorien sind insbesondere:
      </p>
      <ul>
        <li>Hosting- und Datenbank-Dienstleister innerhalb der EU/EWR</li>
        <li>KI-Anbieter zur Erzeugung der Preisvorschläge (innerhalb der EU/EWR betrieben)</li>
        <li>Paddle als Merchant of Record für Verkauf, Abonnementverwaltung, Zahlungen, Steuer- und Rechnungsstellung (siehe Ziffer 5)</li>
        <li>Steuerberater und sonstige berufliche Berater im erforderlichen Umfang</li>
        <li>Behörden, soweit gesetzlich vorgeschrieben</li>
      </ul>

      <h2>5. Zahlungsabwicklung über Paddle</h2>
      <p>
        Die Abwicklung von Bestellungen und Abonnements erfolgt durch{" "}
        <strong>Paddle.com Market Limited</strong>, Judd House, 18–29 Mora Street, London
        EC1V 8BT, Vereinigtes Königreich. Paddle ist Verkäufer (Merchant of Record) und
        eigenständig Verantwortlicher für die zur Vertragsabwicklung verarbeiteten Daten
        (insb. Name, E-Mail, Rechnungs- und Zahlungsdaten, Steuer-Identifikationsmerkmale).
      </p>
      <p>
        Weitere Informationen findest du in der{" "}
        <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer">
          Datenschutzerklärung von Paddle
        </a>.
      </p>

      <h2>6. KI-gestützte Vorschlagserstellung</h2>
      <p>
        Zur Erzeugung der Preisorientierungen werden deine Texteingaben an einen
        KI-Dienst übermittelt, der innerhalb der EU/EWR betrieben wird. Es werden keine
        personenbezogenen Endkundendaten benötigt – gib daher keine Klarnamen oder
        Kontaktdaten von Endkunden in die Beschreibung ein.
      </p>

      <h2>7. Speicherdauer</h2>
      <p>
        Wir speichern deine Daten, solange dein Konto besteht und es für die jeweiligen
        Zwecke erforderlich ist. Auf Wunsch werden dein Konto und alle zugehörigen Daten
        unverzüglich gelöscht. Gesetzliche Aufbewahrungspflichten (insb. handels- und
        steuerrechtliche Pflichten von bis zu 10 Jahren) bleiben unberührt.
      </p>

      <h2>8. Internationale Datenübermittlungen</h2>
      <p>
        Eine Übermittlung in Drittstaaten findet nur statt, wenn ein angemessenes
        Datenschutzniveau besteht (z. B. Angemessenheitsbeschluss der EU-Kommission) oder
        geeignete Garantien gemäß Art. 46 DSGVO (insb. EU-Standardvertragsklauseln)
        vereinbart sind.
      </p>

      <h2>9. Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung
        (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit
        (Art. 20) sowie Widerspruch (Art. 21 DSGVO). Sofern eine Verarbeitung auf einer
        Einwilligung beruht, kannst du diese jederzeit mit Wirkung für die Zukunft
        widerrufen. Wende dich hierzu an{" "}
        <a href="mailto:support@schmitz-walsrode.de">support@schmitz-walsrode.de</a>.
      </p>

      <h2>10. Beschwerderecht</h2>
      <p>
        Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren,
        insbesondere am Ort deines Aufenthalts oder der mutmaßlichen Verletzung. Zuständig
        für den Verantwortlichen ist die Landesbeauftragte für den Datenschutz Niedersachsen.
      </p>

      <h2>11. Datensicherheit</h2>
      <p>
        Die Übertragung erfolgt verschlüsselt (TLS). Die Speicherung erfolgt auf
        gesicherten Servern innerhalb der Europäischen Union. Der Zugriff auf deine Daten
        ist durch ein individuelles Berechtigungssystem geschützt.
      </p>

      <h2>12. Cookies</h2>
      <p>
        Wir setzen ausschließlich technisch notwendige Cookies bzw. lokale Speichertechniken
        ein, die für die Anmeldung und die Bereitstellung der App-Funktionen erforderlich
        sind (z. B. Sitzungs-Cookie, Sprachauswahl). Eine Verarbeitung zu Analyse- oder
        Marketingzwecken findet nicht statt.
      </p>
    </PublicShell>
  );
}
