import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Minus, Plus, RefreshCw } from "lucide-react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.js?url";

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface PdfPreviewRendererProps {
  url: string | null;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

export function PdfPreviewRenderer({ url }: PdfPreviewRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [zoom, setZoom] = useState(1);

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
          const fitScale = Math.min(availableWidth / baseViewport.width, 1.8);
          const scale = fitScale * zoom;
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
  }, [url, containerWidth, zoom]);

  const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  const zoomIn = useCallback(() => setZoom((z) => clampZoom(+(z + 0.25).toFixed(2))), []);
  const zoomOut = useCallback(() => setZoom((z) => clampZoom(+(z - 0.25).toFixed(2))), []);
  const resetZoom = useCallback(() => setZoom(1), []);

  // Ctrl/⌘ + Wheel = Desktop-Zoom
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => clampZoom(+(z + (e.deltaY < 0 ? 0.15 : -0.15)).toFixed(2)));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  // Pinch-Zoom (Touch)
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    let startDist = 0;
    let startZoom = 1;
    const dist = (t: TouchList) => {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.hypot(dx, dy);
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches);
        startZoom = zoom;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        const ratio = dist(e.touches) / startDist;
        setZoom(clampZoom(+(startZoom * ratio).toFixed(2)));
      }
    };
    const onEnd = () => { startDist = 0; };
    node.addEventListener("touchstart", onStart, { passive: true });
    node.addEventListener("touchmove", onMove, { passive: false });
    node.addEventListener("touchend", onEnd);
    return () => {
      node.removeEventListener("touchstart", onStart);
      node.removeEventListener("touchmove", onMove);
      node.removeEventListener("touchend", onEnd);
    };
  }, [zoom]);

  return (
    <div className="relative h-full flex flex-col bg-muted">
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border border-border bg-background/90 p-1 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= MIN_ZOOM}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-foreground hover:bg-muted disabled:opacity-40"
          aria-label="Verkleinern"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="px-1 text-xs tabular-nums text-muted-foreground min-w-[3ch] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= MAX_ZOOM}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-foreground hover:bg-muted disabled:opacity-40"
          aria-label="Vergrößern"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={resetZoom}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-foreground hover:bg-muted"
          aria-label="Zoom zurücksetzen"
          title="An Bildschirm anpassen"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      <div ref={containerRef} className="relative h-full overflow-auto p-3 touch-pan-x touch-pan-y">
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
    </div>
  );
}
