import { buildQuotePDF } from "../src/lib/pdf";
import { writeFileSync } from "fs";

const doc = buildQuotePDF({
  company: {
    name: "Maler Mustermann GmbH",
    contact: "Max Mustermann",
    address: "Beispielstraße 42",
    postalCode: "29664",
    city: "Walsrode",
    phone: "0170-9491315",
    email: "info@maler-mustermann.de",
    website: "www.maler-mustermann.de",
    primaryColor: "#1a3a6c",
    secondaryColor: "#4a4a4a",
  },
  customer: {
    name: "Jan Lampe",
    address: "Hilperdinger Weg 17",
    postalCode: "29664",
    city: "Walsrode",
  },
  date: "30.04.2026",
  lineItems: [
    "Anfahrt und Materialtransport zum Objekt. Inklusive Spritkosten, Be- und Entladen. Abgerechnet werden tatsächlich geleistete Anfahrten, eine Anfahrt pro Arbeitstag.",
    "Abkleben und Abdecken angrenzender Bauteile (Bodenflächen, Türen, Fenster, Glasscheiben) zum Schutz vor Verunreinigungen mit PE-Folie und Maler-Abdeckvlies.",
    "Tapeten restlos entfernen und fachgerecht entsorgen, ca. 40 m².",
    "Wandflächen spachteln, schleifen und mit Tiefgrund grundieren. Erst- und Schlussbeschichtung mit hochwertiger Dispersionsfarbe in Weiß (Q3-Qualität).",
    "Alu-Eckprofile an sämtlichen Außenecken setzen für saubere Kanten.",
  ],
  net: 2151.58,
  vat: 408.80,
  gross: 2560.38,
  vatRate: 19,
  validityDays: 14,
  closingText: "Sollte Ihnen unser Angebot zusagen, freuen wir uns über Ihre Auftragszusage.",
  signatureName: "Max Mustermann",
});

writeFileSync("/tmp/sample.pdf", Buffer.from(doc.output("arraybuffer")));
console.log("OK");
