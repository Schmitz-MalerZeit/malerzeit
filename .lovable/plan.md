## Befund: Technik ist korrekt, Texte widersprechen sich

### ✅ Was bereits richtig funktioniert

**Abrechnungszyklus läuft tatsächlich Kauf‑Datum zu Kauf‑Datum:**
- Paddle erzeugt beim Kauf am 14. eine Billing‑Periode 14. → 14. des Folgemonats und stellt diese als `currentBillingPeriod.startsAt`/`endsAt` im Webhook zur Verfügung.
- Der Webhook (`payments-webhook/index.ts`, `handleSubscriptionCreated/Updated`) speichert diese 1:1 in `subscriptions.current_period_start` / `current_period_end`.
- `useSubscription` und die DB‑Funktion `get_quota_status` nutzen `current_period_start` als Anker für die Monats‑Quota – also läuft die Quota tatsächlich vom 14. bis 14., nicht 1. bis Monatsende.
- Add‑Ons (`grant_pdf_addon`) werden auf dieselbe Billing‑Periode gebucht.
- Verlängerung: Paddle erneuert automatisch zum 14., Webhook `subscription.updated` schreibt die neue Periode.

**Kündigung läuft fair zum Periodenende:**
- Kündigung erfolgt über das Paddle‑Customer‑Portal (`customer-portal` Funktion). Paddle setzt `scheduled_change.action = 'cancel'` zum `current_period_end` – der Webhook spiegelt das als `cancel_at_period_end = true`.
- `Billing.tsx` zeigt dann korrekt „Zugang bis {date}" (`billing.accessUntil`) statt „nächste Abrechnung".
- `useSubscription.subActive` lässt gekündigte Abos bis `current_period_end > now()` aktiv – Nutzer behält Zugriff bis zum Ende seiner bezahlten Periode.

### ⚠️ Was nicht passt: zwei irreführende Texte

In `src/i18n/locales/de.json` (und vermutlich `en.json`) suggeriert die Kommunikation Kalendermonate, obwohl es Kauf‑Anniversary ist:

1. **`pricing.cancelMonthly`** (Zeile 166):
   > „Monatlich: Kündbar zum Ende des **aktuellen Monats** – das Abo endet dann zum **Folgemonat**."
   
   Klingt nach Kalendermonat. Bei Kauf am 14. ist „Folgemonat" missverständlich.

2. **`pricing.quotaInfoMonthlyBody`** (Zeile 164):
   > „Das Kontingent gilt pro Monat und wird **am Monatsanfang zurückgesetzt** – ... Nicht genutzte Angebote verfallen **am Monatsende**."
   
   Falsch. Reset erfolgt zum Anniversary‑Tag (14. → 14.), nicht am 1.

### Plan

**1. Texte in `src/i18n/locales/de.json` korrigieren**
- `pricing.cancelMonthly` → klarstellen: Kündigung jederzeit möglich, Abo endet zum Ende der laufenden Abrechnungsperiode (z. B. „Bei Kauf am 14. läuft das Abo bis zum 14. des Folgemonats").
- `pricing.quotaInfoMonthlyBody` → „Das Kontingent gilt für deine laufende 30‑Tage‑Abrechnungsperiode und wird zum Periodenwechsel (z. B. monatlich am Kauftag) zurückgesetzt."
- Optional: `pricing.sub` ergänzen um „rollierender Monat ab Kauftag".

**2. Gleiche Änderungen in `src/i18n/locales/en.json`** für die englischen Pendants.

**3. Ergänzung im `ConfirmPurchaseDialog`** (optional, aber konsistent zur letzten Anpassung):
- Hinweistext beim ersten Kauf um einen Satz erweitern: „Dein Abrechnungszeitraum startet heute und verlängert sich automatisch zum gleichen Tag im Folgemonat (bzw. Folgejahr)."

**4. Keine Code‑/Logik‑Änderungen am Billing‑ oder Webhook‑Flow nötig** – die Backend‑Logik entspricht bereits genau dem, was du verlangst.

### Ergebnis nach Umsetzung

- Technik: unverändert (war schon korrekt).
- Kommunikation: deckungsgleich mit dem tatsächlichen Verhalten – kein Nutzer kann mehr glauben, am 28. zu buchen heißt am 31. ist Schluss.
