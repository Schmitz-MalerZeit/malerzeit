interface PdfActionWindowOptions {
  url: string;
  fileName: string;
  subject: string;
  emailBody: string;
  whatsappText: string;
  whatsappPhone?: string | null;
}

const PDF_ACTION_PATH = "/pdf-action";
const PENDING_HTML = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>PDF wird erstellt</title>
<style>html,body{margin:0;height:100%;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}</style>
</head><body><p>PDF wird erstellt und gespeichert …</p></body></html>`;

export const openPendingPdfActionWindow = (): Window | null => {
  const win = window.open("about:blank", "_blank");
  if (!win) return null;
  try {
    win.document.open();
    win.document.write(PENDING_HTML);
    win.document.close();
  } catch {
    /* cross-origin write blocked – ignore, the navigation will replace it */
  }
  return win;
};

/**
 * Open / hand off to the PDF action view.
 *
 * IMPORTANT: We deliberately do NOT write to `target.sessionStorage` before
 * navigating, because:
 *   1. `about:blank` has an opaque origin in modern browsers, so its
 *      sessionStorage is not the same as the destination origin's storage.
 *   2. After `location.replace(...)` the document is replaced and any storage
 *      written before is gone.
 *
 * Instead we always persist into the *current* tab's sessionStorage (same
 * origin as the destination) and pass a short token via the URL hash. The
 * destination route reads the payload from sessionStorage on mount.
 */
export const showPdfActionWindow = (
  win: Window | null,
  options: PdfActionWindowOptions,
) => {
  // Persist payload in this tab's sessionStorage – the new tab is same-origin
  // (we navigate to window.location.origin) so it can read it back.
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    sessionStorage.setItem(`pdfActionOptions:${token}`, JSON.stringify(options));
    // Keep a "latest" copy as fallback for same-tab navigation.
    sessionStorage.setItem("pdfActionOptions", JSON.stringify(options));
  } catch (e) {
    console.warn("could not persist pdf action options", e);
  }

  const targetUrl = `${window.location.origin}${PDF_ACTION_PATH}#token=${token}`;
  const target = win && !win.closed ? win : window.open(targetUrl, "_blank");

  if (!target) {
    // Popups blocked – navigate the current tab.
    window.location.href = targetUrl;
    return;
  }

  try {
    target.location.replace(targetUrl);
  } catch {
    // Cross-origin guard (shouldn't happen since we use same origin) – fall
    // back to opening a fresh tab.
    window.open(targetUrl, "_blank");
  }
};
