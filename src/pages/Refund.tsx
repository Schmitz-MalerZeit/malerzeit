import { PublicShell } from "@/components/PublicShell";

export default function Refund() {
  return (
    <PublicShell title="Widerruf & Rückerstattung">
      <p className="text-xs uppercase tracking-wide text-muted-foreground/70">
        Widerrufs- und Rückerstattungsrichtlinie
      </p>
      <p className="text-xs text-muted-foreground">Stand: Mai 2026</p>

      <h2>1. 30-Tage-Geld-zurück-Garantie</h2>
      <p>
        Wir möchten, dass du mit „Malerzeit" zufrieden bist. Daher bieten wir eine
        <strong> 30-tägige Geld-zurück-Garantie</strong>: Wenn du innerhalb von 30 Tagen
        ab Bestelldatum mit deinem Abonnement nicht zufrieden bist, erstatten wir dir den
        gezahlten Betrag in voller Höhe – ohne Angabe von Gründen.
      </p>

      <h2>2. Wie du eine Rückerstattung anforderst</h2>
      <p>
        Die Zahlungsabwicklung erfolgt über unseren Online-Reseller{" "}
        <strong>Paddle.com Market Limited</strong>, der zugleich Verkäufer (Merchant of
        Record) ist und Rückerstattungen bearbeitet. Du kannst eine Rückerstattung auf
        zwei Wegen anfordern:
      </p>
      <ul>
        <li>
          Direkt im Kundenportal von Paddle unter{" "}
          <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a>{" "}
          – melde dich mit der E-Mail-Adresse an, die du beim Kauf verwendet hast.
        </li>
        <li>
          Per E-Mail an{" "}
          <a href="mailto:support@schmitz-walsrode.de">support@schmitz-walsrode.de</a>{" "}
          unter Angabe deiner Bestell- bzw. Rechnungsnummer. Wir leiten deine Anfrage
          unverzüglich an Paddle weiter.
        </li>
      </ul>
      <p>
        Es gilt ergänzend die{" "}
        <a href="https://www.paddle.com/legal/refund-policy" target="_blank" rel="noopener noreferrer">
          Refund Policy von Paddle
        </a>.
      </p>

      <h2>3. Bearbeitung und Auszahlung</h2>
      <p>
        Genehmigte Rückerstattungen werden innerhalb von 5–10 Werktagen über das
        ursprüngliche Zahlungsmittel ausgezahlt. Die genaue Dauer hängt von deinem
        Zahlungsanbieter ab.
      </p>

      <h2>4. Kündigung von Abonnements</h2>
      <p>
        Du kannst dein Abonnement jederzeit über paddle.net oder die Konto-Einstellungen
        in der App kündigen. Nach einer Kündigung außerhalb der 30-Tage-Frist bleibt der
        Zugang bis zum Ende der bereits bezahlten Abrechnungsperiode bestehen; eine
        anteilige Rückerstattung erfolgt in diesem Fall nicht.
      </p>

      <h2>5. Gesetzliches Widerrufsrecht für Verbraucher</h2>
      <p>
        Die App richtet sich an Unternehmer. Sofern dir im Einzelfall dennoch ein
        gesetzliches Widerrufsrecht als Verbraucher zustehen sollte, hast du das Recht,
        binnen 14 Tagen ohne Angabe von Gründen den Vertrag zu widerrufen. Die Widerrufsfrist
        beträgt 14 Tage ab dem Tag des Vertragsschlusses. Um dein Widerrufsrecht auszuüben,
        musst du uns bzw. Paddle mittels einer eindeutigen Erklärung über deinen Entschluss
        informieren. Unsere oben genannte 30-Tage-Geld-zurück-Garantie geht in jedem Fall
        über das gesetzliche Mindestmaß hinaus.
      </p>

      <h2>6. Kontakt</h2>
      <p>
        Bei Fragen zu Rückerstattungen erreichst du uns unter{" "}
        <a href="mailto:support@schmitz-walsrode.de">support@schmitz-walsrode.de</a>.
      </p>
    </PublicShell>
  );
}
