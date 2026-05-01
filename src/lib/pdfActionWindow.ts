interface PdfActionWindowOptions {
  url: string;
  fileName: string;
  subject: string;
  emailBody: string;
  whatsappText: string;
  whatsappPhone?: string | null;
}

export const openPendingPdfActionWindow = () => {
  const win = window.open("", "_blank");
  if (!win) return null;
  win.document.title = "PDF wird erstellt";
  win.document.body.innerHTML =
    "<p style='font-family:system-ui,sans-serif;padding:24px'>PDF wird erstellt und gespeichert …</p>";
  return win;
};

export const showPdfActionWindow = (win: Window | null, options: PdfActionWindowOptions) => {
  const target = win && !win.closed ? win : window.open("", "_blank");

  if (!target) {
    sessionStorage.setItem("pdfActionOptions", JSON.stringify(options));
    window.location.href = "/pdf-action";
    return;
  }

  target.sessionStorage.setItem("pdfActionOptions", JSON.stringify(options));
  target.location.replace(`${window.location.origin}/pdf-action`);
};