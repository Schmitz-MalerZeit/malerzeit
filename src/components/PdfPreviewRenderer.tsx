import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.js?url";

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface PdfPreviewRendererProps {
  url: string | null;
}

export function PdfPreviewRenderer({ url }: PdfPreviewRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateWidth = () => setContainerWidth(node.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!url || !containerWidth || !pagesRef.current) return;

    let cancelled = false;
    let pdfDocument: PDFDocumentProxy | null = null;
    const pagesNode = pagesRef.current;

    const renderPdf = async () => {
      setStatus("loading");
      pagesNode.replaceChildren();

      try {
        const loadingTask = getDocument(url);
        pdfDocument = await loadingTask.promise;
        const availableWidth = Math.max(240, containerWidth - 28);
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
          if (cancelled) return;

          const page = await pdfDocument.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(availableWidth / baseViewport.width, 1.8);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas wird nicht unterstützt");

          canvas.width = Math.floor(viewport.width * pixelRatio);
          canvas.height = Math.floor(viewport.height * pixelRatio);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          canvas.className = "mx-auto block rounded-sm bg-background shadow-md";

          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
          await page.render({ canvasContext: context, viewport }).promise;

          if (cancelled) return;
          pagesNode.appendChild(canvas);
          page.cleanup();
        }

        if (!cancelled) setStatus("ready");
      } catch (error) {
        console.error("PDF preview render failed", error);
        if (!cancelled) setStatus("error");
      }
    };

    renderPdf();

    return () => {
      cancelled = true;
      pagesNode.replaceChildren();
      pdfDocument?.destroy();
    };
  }, [url, containerWidth]);

  return (
    <div ref={containerRef} className="relative h-full overflow-auto bg-muted p-3">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      {status === "error" && (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
          Die PDF-Vorschau konnte auf diesem Gerät nicht gerendert werden.
        </div>
      )}
      <div ref={pagesRef} className="space-y-3" aria-hidden={status !== "ready"} />
    </div>
  );
}