## Ziel
Die App ist heute nur teilweise übersetzt. Aktuell nutzen i18n: Home, Auth, Pricing, Billing, Legal, AppShell, PublicShell, LegalPageView, LanguageSwitcher.

Alle anderen Bereiche enthalten **fest verdrahtete deutsche Strings**. Die werden jetzt komplett auf i18n umgestellt, sodass beim Umschalten auf Englisch wirklich jede UI-Stelle auf Englisch erscheint.

## Umfang (was übersetzt wird)

**Seiten**
- Neuer Vorschlag (`QuoteNew.tsx`) – Eingabefeld, Platzhalter, Buttons, KI-Rückfragen-UI, Toasts, Fehlermeldungen
- Vorschlags-Ergebnis (`QuoteResult.tsx`) – Tabellenüberschriften, Raum-Karten, Buttons (PDF, WhatsApp, E-Mail, Bearbeiten), alle Dialoge & Toasts
- Gespeicherte Vorschläge (`Quotes.tsx`) – Liste, leere Zustände, Aktionen, Bestätigungs-Dialoge
- Firmenprofil (`Profile.tsx`) – Feldlabels, Hinweise, Speichern-Toasts
- Einstellungen (`Settings.tsx`) – restliche Texte (Stundensatz-Aktionen, Validierungen)
- 404 (`NotFound.tsx`)
- PDF-Action-View (`PdfActionView.tsx`) – Mailto/WhatsApp Übergabeseite
- Refund / Terms / Imprint Seiten-Wrapper (Inhalte bleiben rechtlich DE+EN über `legalContent.ts`, das ist bereits zweisprachig)

**Komponenten**
- `HelpDialog` – Schritt-für-Schritt + App-Übersicht (volle EN-Variante)
- `AddonPurchaseDialog`, `AddressAutocomplete`, `CustomerAutocomplete`
- `PdfFlowSheet`, `PdfPreviewRenderer`, `LetterheadPreview`
- `VoiceInput` (Aufnahme-Hinweise, Fehler)
- `NavLink`, `PaymentTestModeBanner`, `RequireSubscription`
- Toast-/Fehlertexte in allen oben genannten

**Dynamische Texte**
- WhatsApp- und E-Mail-Vorlagen (`messageText.ts`, `messageTemplate.ts`, `quoteText.ts`) → sprachabhängig (`i18n.language`) generieren
- PDF-Beschriftungen (`pdf.ts`) → die fixen Labels („Unverbindliche Preisorientierung", „Sehr geehrte Damen und Herren", „Leistungsbeschreibung", Spaltentitel, Summen, Footer-Hinweise) kommen aus i18n je nach aktueller Sprache. Die vom Nutzer/KI eingegebenen Inhalte bleiben in der Original­sprache.

## Technisches Vorgehen

1. `de.json` und `en.json` um die fehlenden Namespaces erweitern:
   - `quoteNew`, `quoteResult`, `quotes`, `profile`, `settingsExtra`, `help`, `pdf`, `messages`, `voice`, `addressAutocomplete`, `customerAutocomplete`, `pdfFlow`, `addon`, `notFound`, `toast`
2. In jeder o.g. Datei `useTranslation()` einbauen und alle sichtbaren Strings durch `t("…")` ersetzen.
3. Für Bibliotheks-Funktionen (`pdf.ts`, `messageText.ts`), die außerhalb React laufen: `i18n.t(...)` direkt aus `@/i18n` importieren – Sprache wird aus dem Browser-Setting gezogen.
4. Pluralisierung über i18next-Plurals (`_one`/`_other`) wo nötig (Räume, Stunden).
5. Datums- und Zahlenformate über `Intl.NumberFormat(i18n.language, …)` – die deutschen Tausender-/Komma-Trennzeichen werden im EN-Modus automatisch zu Punkt/Komma im englischen Stil.
6. Sprache-Umschalter funktioniert bereits global (LanguageSwitcher schreibt nach `localStorage`); keine Änderung nötig.

## Was NICHT übersetzt wird

- Inhalte, die der Maler selbst eingibt (Kundenname, Bauvorhaben, Raumbeschreibungen, KI-Ausgabetexte) – die bleiben so wie eingegeben.
- Eigennamen / Markenname „Malerzeit".
- Rechtstexte sind über `legalContent.ts` schon zweisprachig vorhanden und werden nur korrekt verdrahtet.

## Lieferung
Eine zusammenhängende Änderung; danach kann die Sprache über das Header-Dropdown jederzeit umgeschaltet werden und die komplette App – inkl. PDF und WhatsApp-Nachricht – erscheint auf Englisch.
