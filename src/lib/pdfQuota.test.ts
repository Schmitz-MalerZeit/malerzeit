import { describe, it, expect } from "vitest";
import {
  initialQuotaConsumedForQuote,
  shouldConsumeQuota,
  quotaConsumedAfterEdit,
} from "./pdfQuota";

/**
 * These tests pin down the PDF-quota state machine that QuoteResult relies
 * on. The user-facing rules are:
 *
 *   1. Creating a brand-new PDF counts (consumes 1).
 *   2. Reopening a quote that already has a stored PDF must NEVER count
 *      again — even after a reload, even when the in-memory blob is gone
 *      and we have to rebuild it, even when the language is switched.
 *   3. Editing a quote (or recalculating prices) invalidates the previously
 *      counted PDF: the next download must count as a NEW PDF.
 */

describe("pdfQuota — initialQuotaConsumedForQuote", () => {
  it("does NOT mark quota as consumed for a brand-new quote (no stored PDF)", () => {
    expect(initialQuotaConsumedForQuote({})).toBe(false);
    expect(initialQuotaConsumedForQuote({ pdf_storage_path: null })).toBe(false);
    expect(initialQuotaConsumedForQuote(null)).toBe(false);
    expect(initialQuotaConsumedForQuote(undefined)).toBe(false);
  });

  it("marks quota as already consumed when the quote was reopened with a stored PDF", () => {
    expect(
      initialQuotaConsumedForQuote({ pdf_storage_path: "user/quote-1.pdf" }),
    ).toBe(true);
  });
});

describe("pdfQuota — shouldConsumeQuota", () => {
  it("consumes when no quota has been counted yet for this quote version", () => {
    expect(shouldConsumeQuota({ pdfQuotaConsumed: false })).toBe(true);
  });

  it("does NOT consume again when the quota was already counted for this version", () => {
    // Covers: reopening an existing PDF, rebuilding after language switch
    // without edits, rebuilding after the in-memory blob was lost.
    expect(shouldConsumeQuota({ pdfQuotaConsumed: true })).toBe(false);
  });
});

describe("pdfQuota — quotaConsumedAfterEdit", () => {
  it("resets the consumed flag so the next PDF counts as a NEW one", () => {
    expect(quotaConsumedAfterEdit()).toBe(false);
  });
});

describe("pdfQuota — end-to-end scenarios", () => {
  /**
   * Tiny in-memory simulation of the QuoteResult quota state. Every call to
   * `triggerPdf()` returns whether the RPC `consume_pdf_quota` would be
   * invoked (i.e. whether the user's monthly counter goes up by 1).
   */
  const makeFlow = (parsedQuote: { pdf_storage_path?: string | null } | null = null) => {
    let pdfQuotaConsumed = initialQuotaConsumedForQuote(parsedQuote);
    return {
      get consumed() { return pdfQuotaConsumed; },
      triggerPdf(): boolean {
        const consume = shouldConsumeQuota({ pdfQuotaConsumed });
        if (consume) pdfQuotaConsumed = true;
        return consume;
      },
      edit() { pdfQuotaConsumed = quotaConsumedAfterEdit(); },
    };
  };

  it("Scenario A: creating a new PDF counts exactly once, regenerating without edits does NOT count again", () => {
    const flow = makeFlow(null);
    expect(flow.triggerPdf()).toBe(true);  // first build → +1
    expect(flow.triggerPdf()).toBe(false); // re-download / language switch → no extra count
    expect(flow.triggerPdf()).toBe(false);
  });

  it("Scenario B: reopening a quote that already has a stored PDF never counts", () => {
    const flow = makeFlow({ pdf_storage_path: "user/quote-1.pdf" });
    expect(flow.consumed).toBe(true);
    expect(flow.triggerPdf()).toBe(false); // reopen + rebuild → no count
    expect(flow.triggerPdf()).toBe(false); // and again → still no count
  });

  it("Scenario C: editing a quote invalidates the counter, the next PDF counts as new", () => {
    const flow = makeFlow({ pdf_storage_path: "user/quote-1.pdf" });
    expect(flow.triggerPdf()).toBe(false); // reopen → no count
    flow.edit();                            // user changes something
    expect(flow.triggerPdf()).toBe(true);  // new PDF version → +1
    expect(flow.triggerPdf()).toBe(false); // immediately downloading again → no count
    flow.edit();                            // another edit
    expect(flow.triggerPdf()).toBe(true);  // and again counts as new → +1
  });

  it("Scenario D: brand-new quote, edit before first download still counts only once on download", () => {
    const flow = makeFlow(null);
    flow.edit(); // edits before any PDF was ever created
    expect(flow.triggerPdf()).toBe(true);
    expect(flow.triggerPdf()).toBe(false);
  });
});
