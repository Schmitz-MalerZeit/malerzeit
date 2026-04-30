import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildQuotePDF, prepareLogoForPdf, getImageNaturalSize, type QuotePDFData } from "./pdf";

// Minimaler valider 1x1 PNG als Data-URL (transparent).
const VALID_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const SVG_DATA_URL =
  "data:image/svg+xml;base64," +
  btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');

const baseData = (overrides: Partial<QuotePDFData["company"]> = {}): QuotePDFData => ({
  company: { name: "Mustermaler GmbH", ...overrides },
  date: "01.01.2026",
  lineItems: ["Wand streichen", "Decke spachteln"],
  net: 1000,
  vat: 190,
  gross: 1190,
  vatRate: 19,
});

describe("buildQuotePDF – Logo-Robustheit", () => {
  it("erzeugt ein PDF ohne Logo", () => {
    const doc = buildQuotePDF(baseData());
    expect(doc.output("blob")).toBeInstanceOf(Blob);
  });

  it("erzeugt ein PDF mit validem PNG-Logo", () => {
    const doc = buildQuotePDF(
      baseData({ logoDataUrl: VALID_PNG_DATA_URL, logoNaturalWidth: 1, logoNaturalHeight: 1 })
    );
    expect(doc.output("blob")).toBeInstanceOf(Blob);
  });

  it("crasht NICHT bei nicht unterstütztem SVG-Format (Initial-Fallback)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      buildQuotePDF(baseData({ logoDataUrl: SVG_DATA_URL }))
    ).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("crasht NICHT bei kaputter Data-URL", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const doc = buildQuotePDF(
      baseData({ logoDataUrl: "data:image/png;base64,!!!not-valid-base64!!!" })
    );
    expect(doc.output("blob")).toBeInstanceOf(Blob);
    warn.mockRestore();
  });

  it("crasht NICHT bei fehlenden natural sizes (nutzt Bounding-Box)", () => {
    const doc = buildQuotePDF(
      baseData({ logoDataUrl: VALID_PNG_DATA_URL })
    );
    expect(doc.output("blob")).toBeInstanceOf(Blob);
  });

  it("crasht NICHT bei natural sizes von 0", () => {
    const doc = buildQuotePDF(
      baseData({ logoDataUrl: VALID_PNG_DATA_URL, logoNaturalWidth: 0, logoNaturalHeight: 0 })
    );
    expect(doc.output("blob")).toBeInstanceOf(Blob);
  });

  it("crasht NICHT bei unbekanntem Format (avif/gif)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      buildQuotePDF(baseData({ logoDataUrl: "data:image/avif;base64,AAAA" }))
    ).not.toThrow();
    expect(() =>
      buildQuotePDF(baseData({ logoDataUrl: "data:image/gif;base64,R0lGODlh" }))
    ).not.toThrow();
    warn.mockRestore();
  });

  it("crasht NICHT bei komplett leerer Data-URL", () => {
    expect(() =>
      buildQuotePDF(baseData({ logoDataUrl: "" }))
    ).not.toThrow();
  });

  it("crasht NICHT bei extrem langem Firmennamen ohne Logo (Initial-Fallback nicht aktiv)", () => {
    const doc = buildQuotePDF(
      baseData({
        name: "Sehr Sehr Sehr Langer Firmenname GmbH & Co. KGaA International",
      })
    );
    expect(doc.output("blob")).toBeInstanceOf(Blob);
  });

  it("nutzt Initial-Fallback auch ohne gesetzten Firmennamen", () => {
    const data = baseData({ logoDataUrl: SVG_DATA_URL });
    data.company.name = undefined;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => buildQuotePDF(data)).not.toThrow();
    warn.mockRestore();
  });

  it("verarbeitet HTTP-URL mit .svg-Endung als unsupported", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      buildQuotePDF(baseData({ logoDataUrl: "https://example.com/logo.svg" }))
    ).not.toThrow();
    warn.mockRestore();
  });
});

describe("getImageNaturalSize", () => {
  it("liefert undefined bei kaputter Quelle innerhalb des Timeouts", async () => {
    const result = await getImageNaturalSize("data:image/png;base64,!!!broken!!!");
    expect(result).toBeUndefined();
  });
});

describe("prepareLogoForPdf", () => {
  it("liefert undefined für leere Quelle", async () => {
    const result = await prepareLogoForPdf("");
    expect(result).toBeUndefined();
  });

  it("erkennt Raster-PNG und reicht es unverändert durch", async () => {
    const result = await prepareLogoForPdf(VALID_PNG_DATA_URL);
    expect(result).toBeDefined();
    expect(result?.dataUrl).toBe(VALID_PNG_DATA_URL);
  });

  it("liefert undefined bei nicht-rasterisierbarer SVG-Quelle (jsdom kann nicht rastern)", async () => {
    // jsdom rendert SVGs nicht in Canvas → Fallback-Pfad wird getestet.
    const result = await prepareLogoForPdf("data:image/svg+xml;base64,!!!broken!!!");
    expect(result).toBeUndefined();
  });
});
