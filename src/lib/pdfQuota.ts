/**
 * Pure helpers for the PDF quota state machine used in QuoteResult.
 *
 * Rules (per user request):
 *  - Creating a brand-new PDF MUST consume one PDF from the quota.
 *  - Reopening a previously created PDF (already stored on the quote row)
 *    MUST NOT consume the quota again — even after a page reload, even when
 *    the user changes the PDF language, even when the in-memory blob is gone
 *    and we have to rebuild it.
 *  - Editing the quote (text, items, prices) invalidates the previously
 *    counted PDF: the next download counts as a NEW PDF and consumes quota
 *    again.
 *
 * The QuoteResult component tracks two pieces of state that drive this:
 *   - `pdfQuotaConsumed`: true once the current quote-version has been
 *     counted (either by creation or because we reopened a quote that
 *     already had a stored PDF).
 *   - any edit / recalc resets `pdfQuotaConsumed` back to false.
 */

export interface QuotaDecisionInput {
  /** Quota was already consumed for the current quote version. */
  pdfQuotaConsumed: boolean;
}

/**
 * Should `consume_pdf_quota` be called when the user triggers a PDF build?
 * Returns true only when no quota has been counted yet for this quote
 * version.
 */
export const shouldConsumeQuota = ({ pdfQuotaConsumed }: QuotaDecisionInput): boolean =>
  !pdfQuotaConsumed;

/**
 * Initial value of `pdfQuotaConsumed` when the QuoteResult page mounts for a
 * given quote payload from localStorage. A quote that was already saved with
 * a stored PDF must start out as "already consumed" so reopening it does not
 * double-count.
 */
export const initialQuotaConsumedForQuote = (parsedQuote: {
  pdf_storage_path?: string | null;
} | null | undefined): boolean => {
  return !!parsedQuote?.pdf_storage_path;
};

/**
 * After an edit / recalc the consumed flag must be reset so the NEXT PDF
 * counts again. This helper exists purely so the rule has a single source of
 * truth that can be unit-tested.
 */
export const quotaConsumedAfterEdit = (): boolean => false;
