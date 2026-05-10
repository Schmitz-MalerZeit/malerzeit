## Ziel

Paddle vollständig durch Stripe ersetzen. Geschäftslogik (Tarife, PDF-Kontingent, Add-ons, Affiliate-Codes, Reaktivierung, Up-/Downgrade) bleibt identisch – nur der Zahlungsanbieter darunter wird getauscht.

## Was du vorab brauchst

1. **Stripe-Konto anlegen** auf [stripe.com/de](https://stripe.com/de) – kostenlos, ca. 10 Min.
2. **Account verifizieren** (Bankverbindung, Identitätsnachweis). Kann parallel zur Entwicklung laufen – Test-Modus funktioniert auch ohne abgeschlossene Verifikation.
3. **Stripe Secret Key** aus dem Dashboard kopieren (Developers → API Keys → „Reveal test key" → `sk_test_...`). Den Live-Key (`sk_live_...`) später separat.
4. **Customer Portal aktivieren** in Stripe (Settings → Billing → Customer Portal → Activate test link). Einmalklick.

## Architektur-Überblick

```text
Frontend (React)
  └─ @stripe/stripe-js  →  Checkout-Session öffnen (redirect)
                                              │
                                              ▼
        Edge Functions (Supabase, Deno)       Stripe
        ├─ create-checkout-session  ──────►  POST /v1/checkout/sessions
        ├─ create-portal-session    ──────►  POST /v1/billing_portal/sessions
        ├─ change-subscription      ──────►  POST /v1/subscriptions/{id}
        ├─ stripe-webhook           ◄──────  events (signed)
        ├─ get-stripe-price            ─────►  Lookup price_id ↔ stripe_price_id
        ├─ list-transactions        ──────►  GET  /v1/invoices
        └─ admin-affiliates         ──────►  POST /v1/coupons + /v1/promotion_codes
                  │
                  ▼
        Postgres (subscriptions, pdf_addons, affiliates) – Schema bleibt fast identisch
```

## Datenbank-Änderungen (minimal)

Schema-Spalten bleiben generisch genug. Nur Umbenennungen für Klarheit:

- `subscriptions.paddle_customer_id` → `stripe_customer_id`
- `subscriptions.paddle_subscription_id` → `stripe_subscription_id`
- `pdf_addons.paddle_transaction_id` → `stripe_session_id`
- `affiliates.paddle_discount_id` → `stripe_promotion_code_id` (Discount-Code-Logik wechselt auf Stripe Coupons + Promotion Codes)
- `environment` bleibt (`'sandbox'` / `'live'`) – Stripe nennt es `test` / `live`, wir mappen intern.

Funktionen (`has_active_subscription`, `get_quota_status`, `consume_pdf_quota`, `grant_pdf_addon`, `get_pdf_limit`) bleiben unverändert – die referenzieren nur generische Spalten.

## Stripe-Produktkatalog

Wird über das Stripe Dashboard angelegt (Test-Mode), mit den gleichen Lookup-Keys wie aktuell:
- `starter_monthly`, `starter_yearly`
- `profi_monthly`, `profi_yearly`
- `profiplus_monthly`, `profiplus_yearly`
- `addon_10_pdfs`, `addon_20_pdfs`

→ **Du legst die Produkte/Preise im Stripe Dashboard manuell an** (mit Lookup-Keys = obige Strings). Ich liefere dir eine fertige Liste mit Beträgen und Lookup-Keys, die du 1:1 abtippst (5 Min Arbeit). Vorteil: Du behältst volle Kontrolle, und Up-/Downgrade funktioniert über `lookup_keys`.

## Edge Functions – konkret

| Alt (Paddle) | Neu (Stripe) | Funktion |
|---|---|---|
| `payments-webhook` | `stripe-webhook` | Verarbeitet `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`. Schreibt in `subscriptions` und `pdf_addons`. |
| `customer-portal` | `customer-portal` (umgebaut) | Erstellt Stripe Billing Portal Session. |
| `change-subscription` | `change-subscription` (umgebaut) | Up-/Downgrade per `subscriptions.update` mit `proration_behavior: 'create_prorations'`. Reaktivierung per `cancel_at_period_end: false`. |
| `get-paddle-price` | `get-stripe-price` | Lookup von `lookup_key` → `price_xxx` ID. |
| `list-transactions` | `list-transactions` (umgebaut) | Listet Stripe Invoices. |
| `admin-affiliates` | `admin-affiliates` (umgebaut) | Erstellt Stripe Coupons + Promotion Codes. |

Webhooks werden manuell in Stripe Dashboard registriert (Test + Live separat) – Endpoint-URL liefere ich dir, du fügst die Webhook-Secrets dann via Lovable Secrets ein.

## Frontend-Änderungen

- `src/lib/paddle.ts` → `src/lib/stripe.ts` (initialisiert `@stripe/stripe-js` mit Publishable Key).
- `src/hooks/usePaddleCheckout.ts` → `src/hooks/useStripeCheckout.ts` – ruft `create-checkout-session` Edge Function auf, redirected zu `session.url`.
- `src/components/PaymentTestModeBanner.tsx` – Logik bleibt, prüft jetzt `pk_test_` statt `test_`.
- `src/pages/Pricing.tsx`, `src/pages/Billing.tsx`, `src/components/AddonPurchaseDialog.tsx`, `src/pages/AdminDiscounts.tsx` – Imports und Variablennamen anpassen, Geschäftslogik bleibt.
- `useSubscription` Hook – nur Spaltennamen anpassen (`stripe_*` statt `paddle_*`).

## Secrets

Ich frage diese Secrets via sicherem Formular ab (du gibst sie ein, ich sehe sie nie):

- `STRIPE_SECRET_KEY_TEST` (`sk_test_...`)
- `STRIPE_SECRET_KEY_LIVE` (`sk_live_...`) – kann später nachgereicht werden
- `STRIPE_WEBHOOK_SECRET_TEST` (`whsec_...` aus Stripe Dashboard nach Webhook-Anlage)
- `STRIPE_WEBHOOK_SECRET_LIVE` – später

Publishable Keys (`pk_test_...`, `pk_live_...`) kommen in `.env.development` / `.env.production` (sind öffentlich, kein Secret).

## Migration bestehender Daten

Aktuell sind in `subscriptions` möglicherweise Test-Datensätze von Paddle. Die werden gelöscht (waren nur Sandbox). Echte Live-Subs existieren nicht (Paddle wurde nie freigegeben). Profile, Quotes, Settings usw. bleiben unverändert.

## Reihenfolge der Umsetzung

1. **DB-Migration**: Spalten umbenennen, Paddle-Sandbox-Daten in `subscriptions` löschen.
2. **Secrets**: Du fügst `STRIPE_SECRET_KEY_TEST` und Publishable Key ein.
3. **Stripe-Produkte anlegen**: Du legst im Stripe Dashboard die 8 Produkte/Preise mit Lookup-Keys an (Anleitung liefere ich nach Migration).
4. **Edge Functions**: Stripe-Webhook, Checkout, Portal, Change-Subscription, Add-ons, Affiliates – alle in einem Rutsch.
5. **Frontend**: paddle → stripe Tausch.
6. **Webhook in Stripe registrieren**: Du fügst die URL ein, kopierst das Webhook-Secret zurück.
7. **Test-Lauf**: Mit Testkarte `4242 4242 4242 4242` Komplett-Flow durchspielen (Abo abschließen, upgraden, kündigen, reaktivieren, Add-on kaufen, Affiliate-Code testen).
8. **Paddle-Code & Secrets entfernen**: Alte Edge Functions und `.env`-Einträge löschen.
9. **Live-Vorbereitung**: Sobald dein Stripe-Account verifiziert ist, Live-Keys + Webhook nachreichen, ich tausche die Live-Konfig.

## Was ich von dir nach Plan-Approval brauche

1. **Stripe-Konto** anlegen (5 Min).
2. **Test-Secret-Key** kopieren – ich frage ihn dann via Secrets-Formular ab.
3. Sobald die Edge Functions stehen: **Webhook-Endpoint in Stripe registrieren** (1 Klick mit URL die ich liefere) + Webhook-Secret zurückgeben.
4. **Produkte im Stripe Dashboard anlegen** anhand meiner Liste (10 Min).

Alles andere mache ich.

## Geschätzter Aufwand

- Mein Anteil: 1 lange Session (alle Edge Functions + Frontend-Umbau in einem Zug).
- Dein Anteil verteilt: ~30 Min (Konto, Produkte, Webhook).

Sobald du den Plan freigibst, starte ich mit Schritt 1 (DB-Migration) und sage dir präzise, wann ich welches Secret bzw. welche Aktion von dir brauche.