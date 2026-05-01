interface PdfActionWindowOptions {
  url: string;
  fileName: string;
  subject: string;
  emailBody: string;
  whatsappText: string;
  whatsappPhone?: string | null;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const openPendingPdfActionWindow = () => {
  const win = window.open("", "_blank");
  if (!win) return null;
  win.document.title = "PDF wird erstellt";
  win.document.body.innerHTML =
    "<p style='font-family:system-ui,sans-serif;padding:24px'>PDF wird erstellt und gespeichert …</p>";
  return win;
};

export const showPdfActionWindow = (win: Window | null, options: PdfActionWindowOptions) => {
  const { url, fileName, subject, emailBody, whatsappText, whatsappPhone } = options;
  const target = win && !win.closed ? win : window.open("", "_blank");

  if (!target) {
    window.location.href = url;
    return;
  }

  target.document.open();
  target.document.write(`<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover">
  <title>${escapeHtml(fileName)}</title>
  <style>
    *{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f4f5;color:#18181b}.shell{height:100dvh;display:flex;flex-direction:column}.bar{position:relative;z-index:3;display:grid;grid-template-columns:auto repeat(4,minmax(0,1fr));gap:8px;padding:calc(10px + env(safe-area-inset-top)) 10px 10px;background:#fff;border-bottom:1px solid #e4e4e7;box-shadow:0 1px 2px rgba(0,0,0,.04)}button,a{appearance:none;border:1px solid #d4d4d8;border-radius:8px;background:#fff;color:#18181b;text-decoration:none;font:600 13px system-ui;padding:10px 8px;text-align:center;min-height:42px;display:flex;align-items:center;justify-content:center;cursor:pointer}.primary{background:#18181b;color:#fff;border-color:#18181b}.back{width:46px;font-size:20px;line-height:1}.notice{padding:8px 12px;font-size:12px;line-height:1.35;color:#52525b;background:#fff;border-bottom:1px solid #e4e4e7}.viewer{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;background:#d4d4d8;padding:10px}.pdf{display:block;width:100%;height:100%;min-height:720px;border:0;background:#fff}@media(max-width:560px){.bar{grid-template-columns:auto 1fr 1fr;gap:7px}.bar a,.bar button:not(.back){font-size:12px;padding:9px 6px}.primary{grid-column:2/4}.viewer{padding:0;background:#fff}.pdf{height:100%;min-height:0}}@supports(height:100svh){.shell{height:100svh}}
  </style>
</head>
<body>
  <div class="shell">
    <div class="bar">
      <button class="back" id="back" aria-label="Zurück">‹</button>
      <a class="primary" href="${url}" download="${escapeHtml(fileName)}">Download</a>
      <button id="share">Teilen</button>
      <button id="mail">E-Mail</button>
      <button id="wa">WhatsApp</button>
    </div>
    <div class="notice">Diese PDF ist gespeichert. Du kannst zoomen, zurückgehen, herunterladen oder sie per E-Mail/WhatsApp teilen.</div>
    <div class="viewer"><iframe class="pdf" src="${url}#view=FitH"></iframe></div>
  </div>
  <script>
    const url=${JSON.stringify(url)};
    const fileName=${JSON.stringify(fileName)};
    const subject=${JSON.stringify(subject)};
    const emailBody=${JSON.stringify(emailBody)};
    const waText=${JSON.stringify(whatsappText)};
    async function shareFile(){
      try{
        const blob=await fetch(url).then(r=>r.blob());
        const file=new File([blob],fileName,{type:'application/pdf'});
        if(navigator.canShare&&navigator.canShare({files:[file]})){
          await navigator.share({files:[file],title:subject,text:subject});
          return true;
        }
      }catch(e){}
      return false;
    }
    document.getElementById('back').onclick=()=>{ if(history.length>1) history.back(); else window.close(); };
    document.getElementById('share').onclick=async()=>{ if(!(await shareFile())) alert('Direktes Teilen wird auf diesem Gerät nicht unterstützt. Bitte Download nutzen und die PDF anhängen.'); };
    document.getElementById('mail').onclick=async()=>{ if(await shareFile())return; location.href='mailto:?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(emailBody); };
    document.getElementById('wa').onclick=async()=>{ if(await shareFile())return; ${whatsappPhone ? `location.href='https://wa.me/${whatsappPhone}?text='+encodeURIComponent(waText);` : `location.href='https://wa.me/?text='+encodeURIComponent(waText);`} };
  </script>
</body>
</html>`);
  target.document.close();
};