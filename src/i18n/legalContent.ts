// 1:1 Inhalt der öffentlichen Rechtsseiten (Impressum, Datenschutz, Widerruf).
// Quelle: Originale HTML-Dateien der Landingpage. Deutsche Variante wörtlich,
// englische Variante wortgetreu übersetzt. HTML in `html` ist erlaubt
// (z. B. <strong>, <a>, <ul><li>, <br>) – wird als innerHTML gerendert.

export type LegalSection = {
  h2?: string;
  // Beliebiger HTML-Block (Paragraphen, Listen, Boxen).
  html: string;
};

export type LegalPage = {
  title: string;
  sub: string;
  sections: LegalSection[];
  // Optional: Hinweis-Box am Ende (z. B. "ersetzt keine Rechtsberatung").
  footnote?: string;
};

export type LegalContent = {
  imprint: LegalPage;
  privacy: LegalPage;
  refund: LegalPage;
};

const ADDR_DE = `<strong>Christoph Schmitz</strong><br>Malermanufaktur Raumwerk Schmitz<br>Meirehmer Berg 10<br>29664 Walsrode<br>Deutschland`;
const ADDR_EN = `<strong>Christoph Schmitz</strong><br>Malermanufaktur Raumwerk Schmitz<br>Meirehmer Berg 10<br>29664 Walsrode<br>Germany`;
const MAIL = `<a href="mailto:support@schmitz-walsrode.de">support@schmitz-walsrode.de</a>`;

export const LEGAL_DE: LegalContent = {
  imprint: {
    title: "Impressum",
    sub: "Angaben gemäß § 5 TMG",
    sections: [
      { h2: "Anbieter & Verantwortlicher", html: `<div class="info-box"><p>${ADDR_DE}</p></div>` },
      {
        h2: "Kontakt",
        html: `<div class="info-box"><p><strong>E-Mail:</strong> ${MAIL}<br><strong>Hinweis:</strong> Eine Erreichbarkeit per Telefon wird nicht angeboten. Anfragen werden ausschließlich über den elektronischen Kontaktweg bearbeitet.</p></div>`,
      },
      {
        h2: "Umsatzsteuer-Identifikationsnummer",
        html: `<div class="info-box"><p>Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:<br><strong>DE260741375</strong></p></div>`,
      },
      {
        h2: "Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV",
        html: `<div class="info-box"><p>Christoph Schmitz<br>Meirehmer Berg 10<br>29664 Walsrode</p></div>`,
      },
      {
        h2: "Plattform der EU-Kommission zur Online-Streitbeilegung",
        html: `<p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a></p><p>Unsere E-Mail-Adresse finden Sie oben im Impressum.</p>`,
      },
      {
        h2: "Verbraucherstreitbeilegung",
        html: `<p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>`,
      },
      {
        h2: "Haftung für Inhalte",
        html: `<p>Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.</p><p>Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.</p>`,
      },
      {
        h2: "Haftung für Links",
        html: `<p>Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.</p>`,
      },
      {
        h2: "Urheberrecht",
        html: `<p>Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.</p>`,
      },
    ],
  },
  privacy: {
    title: "Datenschutzerklärung",
    sub: "Stand: Mai 2026 · Verantwortlicher: Christoph Schmitz, Malermanufaktur Raumwerk Schmitz",
    sections: [
      {
        h2: "1. Verantwortlicher",
        html: `<div class="info-box"><p>${ADDR_DE}<br>E-Mail: ${MAIL}</p></div>`,
      },
      {
        h2: "2. Grundsätzliches zur Datenverarbeitung",
        html: `<p>Wir verarbeiten personenbezogene Daten nur, soweit dies gesetzlich erlaubt ist oder du als betroffene Person eingewilligt hast. Die Verarbeitung erfolgt auf Grundlage der Datenschutz-Grundverordnung (DSGVO) sowie des Bundesdatenschutzgesetzes (BDSG).</p>`,
      },
      {
        h2: "3. Hosting & Infrastruktur",
        html: `<div class="info-box"><p><strong>Anwendungs-Hosting:</strong> Lovable (EU-Region)<br><strong>Datenbank & Authentifizierung:</strong> Supabase (EU-Rechenzentrum, Frankfurt/EU-West)<br><strong>Zahlungsabwicklung:</strong> Paddle.com Market Limited (siehe Abschnitt 8)</p><p>Alle Nutzerdaten werden ausschließlich auf Servern innerhalb der Europäischen Union gespeichert und verarbeitet. Ein Transfer in Drittländer findet nicht statt, soweit dies nicht ausdrücklich angegeben ist.</p></div>`,
      },
      {
        h2: "4. Daten beim Besuch der Website",
        html: `<p>Beim Aufrufen unserer Website werden durch den Browser automatisch folgende Daten an unseren Server übermittelt und temporär gespeichert:</p><ul><li>IP-Adresse des anfragenden Rechners (anonymisiert)</li><li>Datum und Uhrzeit des Zugriffs</li><li>Name und URL der abgerufenen Datei</li><li>Übertragene Datenmenge</li><li>Browser-Typ, -Version und Betriebssystem</li><li>Referrer-URL (zuvor besuchte Seite)</li></ul><p>Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der technischen Bereitstellung und Sicherheit des Dienstes). Die Daten werden nach spätestens 7 Tagen automatisch gelöscht.</p>`,
      },
      {
        h2: "5. Registrierung & Nutzerkonto",
        html: `<p>Zur Nutzung von MalerZeit AI ist eine Registrierung erforderlich. Dabei erheben wir:</p><ul><li>E-Mail-Adresse</li><li>Passwort (verschlüsselt gespeichert, nie im Klartext)</li><li>Firmendaten (Name, Adresse, Logo, Firmenfarben) – freiwillig, für PDF-Erstellung</li><li>Stundensätze – freiwillig, für KI-Kalkulation</li></ul><p>Die Verarbeitung dient der Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO). Kundendaten und erstellte Preisorientierungen werden verschlüsselt gespeichert und sind ausschließlich dem jeweiligen Nutzer zugänglich.</p>`,
      },
      {
        h2: "6. Erstellte Preisorientierungen & Kundendaten",
        html: `<p>Im Rahmen der App-Nutzung speicherst du Kundendaten (Name, Adresse) sowie erstellte Preisorientierungen. Diese Daten:</p><ul><li>werden ausschließlich auf EU-Servern (Supabase) gespeichert</li><li>sind nur für dich als eingeloggten Nutzer sichtbar</li><li>werden nicht an Dritte weitergegeben</li><li>können jederzeit von dir gelöscht werden</li></ul><p>Als Nutzer bist du für die Einhaltung der DSGVO gegenüber deinen eigenen Kunden verantwortlich (du bist der datenschutzrechtliche Verantwortliche für diese Daten). Wir empfehlen, in deinen eigenen Datenschutzhinweisen auf die Verwendung von MalerZeit AI hinzuweisen.</p>`,
      },
      {
        h2: "7. Nutzung von KI-Diensten",
        html: `<p>Zur Generierung von Preisorientierungen werden die von dir eingegebenen Leistungsbeschreibungen an einen KI-Dienst übermittelt. Die Verarbeitung erfolgt innerhalb der EU. Es werden keine personenbezogenen Daten deiner Kunden an den KI-Dienst übertragen – lediglich die Leistungsbeschreibung (Raumgröße, Tätigkeiten, Materialangaben).</p>`,
      },
      {
        h2: "8. Zahlungsabwicklung über Paddle",
        html: `<p>Die Zahlungsabwicklung erfolgt über <strong>Paddle.com Market Limited</strong> (Core B, 50 Rugby Road, Dublin 4, Irland). Paddle agiert als sogenannter „Merchant of Record" – das bedeutet: Paddle ist der rechtliche Verkäufer gegenüber dem Kunden und verantwortlich für die Abwicklung der Zahlungstransaktion.</p><p>Zur Zahlungsabwicklung übermitteln wir folgende Daten an Paddle:</p><ul><li>E-Mail-Adresse</li><li>Gewählter Tarif und Abrechnungszeitraum</li></ul><p>Paddle erhebt zusätzlich die für die Zahlungsabwicklung notwendigen Daten (Zahlungsmitteldetails, Rechnungsadresse). Weitere Informationen zur Datenverarbeitung durch Paddle findest du unter: <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer">paddle.com/legal/privacy</a></p><p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).</p>`,
      },
      {
        h2: "9. Sprache & Lokalisierung",
        html: `<p>Deine Spracheinstellung (Deutsch/Englisch) wird im lokalen Speicher deines Browsers (localStorage) gespeichert. Diese Daten verbleiben auf deinem Gerät und werden nicht an uns übertragen.</p>`,
      },
      {
        h2: "10. Keine Analyse- oder Tracking-Tools",
        html: `<p>Wir setzen keine Analyse-, Tracking- oder Werbe-Tools (wie Google Analytics, Facebook Pixel o. Ä.) ein. Es werden keine Cookies zu Werbezwecken gesetzt.</p>`,
      },
      {
        h2: "11. Deine Rechte als betroffene Person",
        html: `<p>Du hast gemäß DSGVO folgende Rechte:</p><ul><li><strong>Auskunftsrecht</strong> (Art. 15 DSGVO): Recht auf Auskunft über gespeicherte Daten</li><li><strong>Berichtigungsrecht</strong> (Art. 16 DSGVO): Recht auf Korrektur unrichtiger Daten</li><li><strong>Löschungsrecht</strong> (Art. 17 DSGVO): Recht auf Löschung deiner Daten</li><li><strong>Einschränkung der Verarbeitung</strong> (Art. 18 DSGVO)</li><li><strong>Datenübertragbarkeit</strong> (Art. 20 DSGVO)</li><li><strong>Widerspruchsrecht</strong> (Art. 21 DSGVO)</li></ul><p>Zur Ausübung deiner Rechte wende dich an: ${MAIL}</p>`,
      },
      {
        h2: "12. Beschwerderecht bei der Aufsichtsbehörde",
        html: `<p>Du hast das Recht, dich bei der zuständigen Datenschutzaufsichtsbehörde zu beschweren. Für Niedersachsen ist dies:</p><div class="info-box"><p><strong>Die Landesbeauftragte für den Datenschutz Niedersachsen</strong><br>Prinzenstraße 5, 30159 Hannover<br>E-Mail: <a href="mailto:poststelle@lfd.niedersachsen.de">poststelle@lfd.niedersachsen.de</a><br>Web: <a href="https://www.lfd.niedersachsen.de" target="_blank" rel="noopener noreferrer">www.lfd.niedersachsen.de</a></p></div>`,
      },
      {
        h2: "13. Datensicherheit",
        html: `<p>Wir verwenden HTTPS-Verschlüsselung für alle Datenübertragungen. Passwörter werden ausschließlich verschlüsselt (gehasht) gespeichert. Zugriffe auf die Datenbank sind durch Authentifizierung und Row-Level-Security geschützt.</p>`,
      },
      {
        h2: "14. Aktualität dieser Datenschutzerklärung",
        html: `<p>Diese Datenschutzerklärung gilt ab Mai 2026 und kann bei Änderungen des Dienstes aktualisiert werden. Die jeweils aktuelle Version ist stets auf dieser Seite abrufbar.</p>`,
      },
    ],
    footnote: `<strong>Hinweis:</strong> Diese Datenschutzerklärung wurde sorgfältig erstellt, ersetzt jedoch keine individuelle Rechtsberatung. Wir empfehlen eine Prüfung durch einen Datenschutzbeauftragten oder Rechtsanwalt vor dem Livegang.`,
  },
  refund: {
    title: "Widerrufsbelehrung",
    sub: "Informationen zu deinem gesetzlichen Widerrufsrecht gemäß §§ 355 ff. BGB",
    sections: [
      {
        h2: "1. Widerrufsrecht",
        html: `<p>Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.</p><p>Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses (Aktivierung des Abonnements).</p><p>Um dein Widerrufsrecht auszuüben, musst du uns</p><div class="info-box"><p>${ADDR_DE}<br>E-Mail: ${MAIL}</p></div><p>mittels einer eindeutigen Erklärung (z. B. eine per E-Mail versandte Mitteilung) über deinen Entschluss, diesen Vertrag zu widerrufen, informieren. Du kannst dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.</p><p>Zur Wahrung der Widerrufsfrist reicht es aus, dass du die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absendest.</p>`,
      },
      {
        h2: "2. Besonderheit bei digitalen Abonnements",
        html: `<div class="warning-box"><p><strong>Wichtiger Hinweis:</strong> MalerZeit AI ist ein digitaler Dienst, der sofort nach Abschluss des Abonnements nutzbar ist. Gemäß § 356 Abs. 5 BGB erlischt dein Widerrufsrecht vorzeitig, wenn du ausdrücklich zugestimmt hast, dass wir vor Ablauf der Widerrufsfrist mit der Ausführung des Vertrages beginnen, und du zur Kenntnis genommen hast, dass du durch deine Zustimmung dein Widerrufsrecht verlierst.</p><p>Diese Zustimmung wird dir beim Abschluss des Abonnements ausdrücklich eingeholt. Wenn du dieser Zustimmung zustimmst und den Dienst sofort nutzt, erlischt damit dein Widerrufsrecht.</p></div>`,
      },
      {
        h2: "3. Folgen des Widerrufs",
        html: `<p>Wenn du diesen Vertrag widerrufst, hat Paddle (als Zahlungsabwickler und Merchant of Record) dir alle Zahlungen, die wir von dir erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über deinen Widerruf dieses Vertrages bei uns eingegangen ist.</p><p>Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das du bei der ursprünglichen Transaktion eingesetzt hast, sofern nicht ausdrücklich etwas anderes vereinbart wurde; in keinem Fall werden dir wegen dieser Rückzahlung Entgelte berechnet.</p><p>Hast du verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen sollen, so hast du uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem du uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrages unterrichtest, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.</p>`,
      },
      {
        h2: "4. Kündigung des Abonnements (kein Widerruf)",
        html: `<p>Das Widerrufsrecht gilt nur für den Abschluss des ersten Abonnements innerhalb der 14-tägigen Widerrufsfrist. Für die laufende Kündigung des Abonnements gelten folgende Fristen:</p><ul><li><strong>Monatliches Abo:</strong> Kündbar jederzeit zum Ende des laufenden Abrechnungsmonats. Das Abo endet dann zum Beginn des Folgemonats.</li><li><strong>Jährliches Abo:</strong> Kündbar bis spätestens einen (1) Monat vor Ablauf des Vertragsjahres. Ohne Kündigung verlängert sich das Abo automatisch um ein weiteres Jahr.</li></ul><p>Die Kündigung kann über das Kundenportal oder per E-Mail an ${MAIL} erfolgen. Die Zahlungsabwicklung und Verwaltung des Abonnements erfolgt über <strong>Paddle.com Market Limited</strong>.</p>`,
      },
      {
        h2: "5. Muster-Widerrufsformular",
        html: `<div class="muster-box"><h3>Muster-Widerrufsformular</h3><p>(Wenn du den Vertrag widerrufen willst, fülle dieses Formular aus und sende es zurück.)</p><p>An:<br>Christoph Schmitz, Malermanufaktur Raumwerk Schmitz<br>Meirehmer Berg 10, 29664 Walsrode<br>E-Mail: support@schmitz-walsrode.de</p><p>Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf des Abonnements für MalerZeit AI.</p><p>Bestellt am (*): ___________________________</p><p>Name des/der Verbraucher(s): ___________________________</p><p>Anschrift des/der Verbraucher(s): ___________________________</p><p>E-Mail-Adresse des Kontos: ___________________________</p><p>Datum: ___________________________</p><p class="muster-hint">(*) Unzutreffendes streichen.</p></div>`,
      },
    ],
    footnote: `<strong>Hinweis:</strong> Diese Widerrufsbelehrung wurde nach aktuellem deutschen Verbraucherrecht (BGB) erstellt. Da Paddle als Merchant of Record agiert, können sich Besonderheiten ergeben. Wir empfehlen eine abschließende Prüfung durch einen Rechtsanwalt vor dem Livegang.`,
  },
};

export const LEGAL_EN: LegalContent = {
  imprint: {
    title: "Legal Notice",
    sub: "Information pursuant to § 5 TMG (German Telemedia Act)",
    sections: [
      { h2: "Provider & Responsible Person", html: `<div class="info-box"><p>${ADDR_EN}</p></div>` },
      {
        h2: "Contact",
        html: `<div class="info-box"><p><strong>Email:</strong> ${MAIL}<br><strong>Note:</strong> We do not offer phone support. Inquiries are handled exclusively via electronic contact.</p></div>`,
      },
      {
        h2: "VAT Identification Number",
        html: `<div class="info-box"><p>VAT identification number pursuant to § 27a German VAT Act:<br><strong>DE260741375</strong></p></div>`,
      },
      {
        h2: "Responsible for content under § 55 (2) RStV",
        html: `<div class="info-box"><p>Christoph Schmitz<br>Meirehmer Berg 10<br>29664 Walsrode</p></div>`,
      },
      {
        h2: "EU Online Dispute Resolution Platform",
        html: `<p>The European Commission provides a platform for online dispute resolution (ODR): <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a></p><p>Our email address can be found above.</p>`,
      },
      {
        h2: "Consumer Dispute Resolution",
        html: `<p>We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board.</p>`,
      },
      {
        h2: "Liability for Content",
        html: `<p>As a service provider, we are responsible for our own content on these pages in accordance with general laws pursuant to § 7 (1) TMG. Pursuant to §§ 8 to 10 TMG, however, we as a service provider are not obliged to monitor transmitted or stored third-party information or to investigate circumstances indicating illegal activity.</p><p>Obligations to remove or block the use of information under general laws remain unaffected. Liability in this respect, however, is only possible from the point in time at which a concrete infringement of the law becomes known. Upon becoming aware of such infringements, we will remove this content immediately.</p>`,
      },
      {
        h2: "Liability for Links",
        html: `<p>Our offering contains links to external third-party websites whose content we have no control over. We can therefore not assume any liability for this third-party content. The respective provider or operator of the linked pages is always responsible for their content.</p>`,
      },
      {
        h2: "Copyright",
        html: `<p>Content and works on these pages created by the site operator are subject to German copyright law. Reproduction, processing, distribution and any kind of use outside the limits of copyright require the written consent of the respective author or creator.</p>`,
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sub: "As of: May 2026 · Controller: Christoph Schmitz, Malermanufaktur Raumwerk Schmitz",
    sections: [
      {
        h2: "1. Controller",
        html: `<div class="info-box"><p>${ADDR_EN}<br>Email: ${MAIL}</p></div>`,
      },
      {
        h2: "2. General principles of data processing",
        html: `<p>We process personal data only insofar as this is permitted by law or you, as the data subject, have given your consent. Processing is based on the General Data Protection Regulation (GDPR) and the German Federal Data Protection Act (BDSG).</p>`,
      },
      {
        h2: "3. Hosting & Infrastructure",
        html: `<div class="info-box"><p><strong>Application hosting:</strong> Lovable (EU region)<br><strong>Database & authentication:</strong> Supabase (EU data center, Frankfurt/EU-West)<br><strong>Payment processing:</strong> Paddle.com Market Limited (see Section 8)</p><p>All user data is stored and processed exclusively on servers within the European Union. No transfer to third countries takes place unless expressly stated.</p></div>`,
      },
      {
        h2: "4. Data when visiting the website",
        html: `<p>When you visit our website, the following data is automatically transmitted by your browser to our server and temporarily stored:</p><ul><li>IP address of the requesting computer (anonymized)</li><li>Date and time of access</li><li>Name and URL of the file accessed</li><li>Amount of data transferred</li><li>Browser type, version and operating system</li><li>Referrer URL (previously visited page)</li></ul><p>Legal basis: Art. 6 (1) lit. f GDPR (legitimate interest in the technical provision and security of the service). The data is automatically deleted after no more than 7 days.</p>`,
      },
      {
        h2: "5. Registration & user account",
        html: `<p>Registration is required to use MalerZeit AI. We collect:</p><ul><li>Email address</li><li>Password (stored encrypted, never in plain text)</li><li>Company data (name, address, logo, company colors) – optional, for PDF generation</li><li>Hourly rates – optional, for AI calculation</li></ul><p>Processing serves the performance of the contract (Art. 6 (1) lit. b GDPR). Customer data and generated price quotes are stored encrypted and accessible only to the respective user.</p>`,
      },
      {
        h2: "6. Generated price quotes & customer data",
        html: `<p>While using the app, you store customer data (name, address) as well as generated price quotes. This data:</p><ul><li>is stored exclusively on EU servers (Supabase)</li><li>is only visible to you as the logged-in user</li><li>is not shared with third parties</li><li>can be deleted by you at any time</li></ul><p>As a user, you are responsible for compliance with the GDPR towards your own customers (you are the data controller for this data). We recommend referring to the use of MalerZeit AI in your own privacy notices.</p>`,
      },
      {
        h2: "7. Use of AI services",
        html: `<p>To generate price quotes, the service descriptions you enter are transmitted to an AI service. Processing takes place within the EU. No personal data of your customers is transferred to the AI service – only the service description (room size, activities, material details).</p>`,
      },
      {
        h2: "8. Payment processing via Paddle",
        html: `<p>Payment processing is handled by <strong>Paddle.com Market Limited</strong> (Core B, 50 Rugby Road, Dublin 4, Ireland). Paddle acts as the so-called "Merchant of Record" – meaning Paddle is the legal seller to the customer and responsible for processing the payment transaction.</p><p>For payment processing, we transmit the following data to Paddle:</p><ul><li>Email address</li><li>Selected plan and billing period</li></ul><p>Paddle additionally collects the data necessary for payment processing (payment method details, billing address). Further information on data processing by Paddle: <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer">paddle.com/legal/privacy</a></p><p>Legal basis: Art. 6 (1) lit. b GDPR (performance of contract).</p>`,
      },
      {
        h2: "9. Language & localization",
        html: `<p>Your language setting (German/English) is stored in your browser's local storage. This data remains on your device and is not transmitted to us.</p>`,
      },
      {
        h2: "10. No analytics or tracking tools",
        html: `<p>We do not use any analytics, tracking or advertising tools (such as Google Analytics, Facebook Pixel, etc.). No cookies are set for advertising purposes.</p>`,
      },
      {
        h2: "11. Your rights as a data subject",
        html: `<p>Under the GDPR, you have the following rights:</p><ul><li><strong>Right of access</strong> (Art. 15 GDPR): right to information about stored data</li><li><strong>Right to rectification</strong> (Art. 16 GDPR): right to correct inaccurate data</li><li><strong>Right to erasure</strong> (Art. 17 GDPR): right to deletion of your data</li><li><strong>Restriction of processing</strong> (Art. 18 GDPR)</li><li><strong>Data portability</strong> (Art. 20 GDPR)</li><li><strong>Right to object</strong> (Art. 21 GDPR)</li></ul><p>To exercise your rights, contact: ${MAIL}</p>`,
      },
      {
        h2: "12. Right to lodge a complaint with a supervisory authority",
        html: `<p>You have the right to lodge a complaint with the competent data protection supervisory authority. For Lower Saxony this is:</p><div class="info-box"><p><strong>The State Commissioner for Data Protection of Lower Saxony</strong><br>Prinzenstraße 5, 30159 Hannover, Germany<br>Email: <a href="mailto:poststelle@lfd.niedersachsen.de">poststelle@lfd.niedersachsen.de</a><br>Web: <a href="https://www.lfd.niedersachsen.de" target="_blank" rel="noopener noreferrer">www.lfd.niedersachsen.de</a></p></div>`,
      },
      {
        h2: "13. Data security",
        html: `<p>We use HTTPS encryption for all data transmissions. Passwords are stored exclusively in encrypted (hashed) form. Database access is protected by authentication and row-level security.</p>`,
      },
      {
        h2: "14. Validity of this privacy policy",
        html: `<p>This privacy policy applies as of May 2026 and may be updated when the service changes. The current version is always available on this page.</p>`,
      },
    ],
    footnote: `<strong>Note:</strong> This privacy policy was prepared with care but does not replace individual legal advice. We recommend a review by a data protection officer or lawyer before going live.`,
  },
  refund: {
    title: "Right of Withdrawal",
    sub: "Information about your statutory right of withdrawal under §§ 355 et seq. BGB (German Civil Code)",
    sections: [
      {
        h2: "1. Right of withdrawal",
        html: `<p>You have the right to withdraw from this contract within fourteen days without giving any reason.</p><p>The withdrawal period is fourteen days from the day of the conclusion of the contract (activation of the subscription).</p><p>To exercise your right of withdrawal, you must inform us:</p><div class="info-box"><p>${ADDR_EN}<br>Email: ${MAIL}</p></div><p>by means of a clear statement (e.g. a notification sent by email) of your decision to withdraw from this contract. You may use the attached model withdrawal form, but it is not mandatory.</p><p>To meet the withdrawal deadline, it is sufficient that you send the notification of your exercise of the right of withdrawal before the withdrawal period has expired.</p>`,
      },
      {
        h2: "2. Specifics for digital subscriptions",
        html: `<div class="warning-box"><p><strong>Important note:</strong> MalerZeit AI is a digital service that can be used immediately after the subscription is concluded. Pursuant to § 356 (5) BGB, your right of withdrawal expires prematurely if you have expressly consented to us starting performance of the contract before the end of the withdrawal period and you have acknowledged that by giving your consent you lose your right of withdrawal.</p><p>This consent is expressly obtained from you when you conclude the subscription. If you give this consent and use the service immediately, your right of withdrawal expires.</p></div>`,
      },
      {
        h2: "3. Consequences of withdrawal",
        html: `<p>If you withdraw from this contract, Paddle (as payment processor and Merchant of Record) shall reimburse you all payments received from you without undue delay and no later than fourteen days from the day on which we received notification of your withdrawal from this contract.</p><p>For this reimbursement we will use the same means of payment that you used for the original transaction, unless expressly agreed otherwise; in no case will you be charged any fees as a result of this reimbursement.</p><p>If you have requested that the services begin during the withdrawal period, you shall pay us a reasonable amount corresponding to the proportion of services already provided up to the time you notify us of the exercise of the right of withdrawal compared to the full scope of services provided for in the contract.</p>`,
      },
      {
        h2: "4. Cancellation of the subscription (not withdrawal)",
        html: `<p>The right of withdrawal applies only to the conclusion of the first subscription within the 14-day withdrawal period. The following terms apply to ongoing cancellation of the subscription:</p><ul><li><strong>Monthly subscription:</strong> Cancellable at any time by the end of the current billing month. The subscription ends at the start of the following month.</li><li><strong>Yearly subscription:</strong> Cancellable up to one (1) month before the end of the contract year. Without cancellation, the subscription automatically renews for another year.</li></ul><p>Cancellation can be made via the customer portal or by email to ${MAIL}. Payment processing and subscription management are handled by <strong>Paddle.com Market Limited</strong>.</p>`,
      },
      {
        h2: "5. Model withdrawal form",
        html: `<div class="muster-box"><h3>Model Withdrawal Form</h3><p>(If you wish to withdraw from the contract, please fill out this form and return it.)</p><p>To:<br>Christoph Schmitz, Malermanufaktur Raumwerk Schmitz<br>Meirehmer Berg 10, 29664 Walsrode, Germany<br>Email: support@schmitz-walsrode.de</p><p>I/We (*) hereby withdraw from the contract concluded by me/us (*) for the purchase of the MalerZeit AI subscription.</p><p>Ordered on (*): ___________________________</p><p>Name of consumer(s): ___________________________</p><p>Address of consumer(s): ___________________________</p><p>Email address of the account: ___________________________</p><p>Date: ___________________________</p><p class="muster-hint">(*) Delete as appropriate.</p></div>`,
      },
    ],
    footnote: `<strong>Note:</strong> This withdrawal notice was drafted in accordance with current German consumer law (BGB). As Paddle acts as Merchant of Record, particularities may apply. We recommend a final review by a lawyer before going live.`,
  },
};

export function getLegalContent(lang: string): LegalContent {
  return lang.startsWith("en") ? LEGAL_EN : LEGAL_DE;
}
