## Ziel

Sobald der Nutzer in der neuen Preisorientierung zum ersten Mal auf "Weiter" tippt, soll der Vorschlag bereits dauerhaft gespeichert sein – nicht nur in localStorage, sondern als Datensatz unter "Gespeicherte Vorschläge". Dort ist er als **Entwurf (noch kein PDF erstellt)** sichtbar und lässt sich jederzeit weiter bearbeiten und später als PDF abschließen.

So gehen Eingaben nicht mehr verloren, wenn der Nutzer versehentlich zurück tippt, die App schließt oder der Bildschirm in den Standby geht.

## Was geändert wird

1. **Sofort-Speicherung beim "Weiter"-Klick** in `src/pages/QuoteNew.tsx`
   - Direkt nach dem Klick wird ein Entwurf-Datensatz in der Tabelle `quotes` angelegt (oder beim erneuten "Weiter" aktualisiert).
   - Felder: Kunde, Beschreibung, Stundensätze-Snapshot, Material-Aufschlag, MwSt., Antworten auf Rückfragen, ggf. erste KI-Antwort.
   - Die ID wird in `localStorage` mitgeführt, damit Folge-Schritte (Rückfragen → KI → Vorschau → PDF) denselben Datensatz updaten statt neue zu erzeugen.
   - Bei verlorener Verbindung: weiterhin localStorage als Fallback, Speicherung wird beim nächsten Erfolg nachgeholt.

2. **Entwurf-Anzeige in `src/pages/Quotes.tsx`**
   - Vorschläge ohne `pdf_storage_path` bekommen ein deutliches Badge **„Entwurf · noch kein PDF"**.
   - Klick auf einen Entwurf führt nicht zur PDF-Vorschau, sondern in die Eingabemaske `/quote/new` mit vorausgefüllten Daten (Kunde, Beschreibung, Antworten, ggf. KI-Ergebnis).
   - Sortierung unverändert (neueste oben), Entwürfe sind klar von fertigen Vorschlägen unterscheidbar.

3. **Resume-Logik in `QuoteNew`**
   - Beim Aufruf mit `?resume=<quote_id>` lädt die Seite den Datensatz aus der DB und stellt den passenden Schritt wieder her (Eingabe / Rückfragen / fertige Vorschau).
   - Wenn schon eine KI-Antwort vorhanden ist, springt der Nutzer nach dem letzten "Weiter" direkt in `/quote/result` mit demselben Datensatz.

4. **PDF-Erstellung in `QuoteResult`**
   - Statt einen neuen Datensatz anzulegen, wird der bestehende Entwurf mit der PDF aktualisiert (über die schon vorhandene `update`-Verzweigung anhand `savedQuoteId`).
   - Aus „Entwurf" wird so automatisch ein vollwertiger Vorschlag, sobald das PDF erzeugt wurde.

## Hinweise

- Keine Schema-Änderung nötig: `pdf_storage_path IS NULL` ist bereits eindeutig „noch kein PDF".
- Bestehende RLS-Policies decken Insert/Update/Select/Delete für eigene Vorschläge ab – kein Migrations-Bedarf.
- Stundenlöhne und Einstellungen werden weiterhin live aus den Settings geladen, damit Änderungen am Stammdaten-Stand auch beim Resume berücksichtigt werden.
- Der bestehende localStorage-Autosave bleibt als zusätzliche Sicherheitsschicht erhalten.

## Was bewusst NICHT verändert wird

- Layout und Optik der Eingabemaske bleiben unverändert.
- PDF-Kontingent / Trial-Zähler werden weiterhin erst bei tatsächlicher PDF-Erstellung verbraucht – Entwürfe kosten nichts.
- Rechnungs-/Angebotslogik (GAEB-Export, WhatsApp etc.) bleibt unverändert.
