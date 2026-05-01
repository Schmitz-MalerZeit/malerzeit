import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Copy, Loader2, Minus, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.js?url";

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export interface PdfDiagnostics {
  url: string | null;
  urlKind: "blob" | "data" | "https" | "http" | "other" | "none";
  startedAt: string;
  fetchMs?: number;
  parseMs?: number;
  renderMs?: number;
  totalMs?: number;
  httpStatus?: number;
  httpStatusText?: string;
  contentType?: string | null;
  contentLength?: number | null;
  receivedBytes?: number;
  numPages?: number;
  pdfHeader?: string;
  workerSrc?: string;
  errorPhase?: "fetch" | "parse" | "render";
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
  userAgent?: string;
}

interface PdfPreviewRendererProps {
  url: string | null;
  onLoadPdfData?: (data: Uint8Array) => void;
  onDiagnostics?: (d: PdfDiagnostics) => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

const classifyUrl = (u: string | null): PdfDiagnostics["urlKind"] => {
  if (!u) return "none";
  if (u.startsWith("blob:")) return "blob";
  if (u.startsWith("data:")) return "data";
  if (u.startsWith("https:")) return "https";
  if (u.startsWith("http:")) return "http";
  return "other";
};

export function PdfPreviewRenderer({ url, onLoadPdfData, onDiagnostics }: PdfPreviewRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const pageElementsRef = useRef<HTMLCanvasElement[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [zoom, setZoom] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [pageInputError, setPageInputError] = useState<string | null>(null);
  const [diag, setDiag] = useState<PdfDiagnostics | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);

  const pushDiag = useCallback((next: PdfDiagnostics) => {
    setDiag(next);
    window.setTimeout(() => onDiagnostics?.(next), 0);
    // Also log to the console so it appears in browser devtools.
    // eslint-disable-next-line no-console
    console[next.errorPhase ? "error" : "info"]("[PDF-Preview]", next);
  }, [onDiagnostics]);

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
    if (!url) {
      setPdfData(null);
      return;
    }

    let cancelled = false;
    const startedAt = new Date().toISOString();
    const t0 = performance.now();
    const baseDiag: PdfDiagnostics = {
      url,
      urlKind: classifyUrl(url),
      startedAt,
      workerSrc: pdfWorkerSrc,
      userAgent: navigator.userAgent,
    };
    setStatus("loading");
    setPdfData(null);
    setDiagOpen(false);
    pushDiag(baseDiag);

    fetch(url)
      .then(async (response) => {
        const fetchMs = Math.round(performance.now() - t0);
        const contentType = response.headers.get("content-type");
        const lenHeader = response.headers.get("content-length");
        const contentLength = lenHeader ? Number(lenHeader) : null;
        const httpInfo: Partial<PdfDiagnostics> = {
          fetchMs,
          httpStatus: response.status,
          httpStatusText: response.statusText,
          contentType,
          contentLength: Number.isFinite(contentLength) ? contentLength : null,
        };
        if (!response.ok) {
          const err = new Error(`HTTP ${response.status} ${response.statusText}`.trim());
          (err as any).__phase = "fetch";
          (err as any).__http = httpInfo;
          throw err;
        }
        const buffer = await response.arrayBuffer();
        return { buffer, httpInfo };
      })
      .then(({ buffer, httpInfo }) => {
        if (cancelled) return;
        const bytes = new Uint8Array(buffer);
        const header = new TextDecoder("ascii", { fatal: false })
          .decode(bytes.slice(0, 8))
          .replace(/[^\x20-\x7E]/g, ".");
        const next: PdfDiagnostics = {
          ...baseDiag,
          ...httpInfo,
          receivedBytes: bytes.byteLength,
          pdfHeader: header,
        };
        pushDiag(next);
        if (!header.startsWith("%PDF-")) {
          const err = new Error(`Antwort ist keine PDF-Datei (Header: "${header}")`);
          (err as any).__phase = "parse";
          throw err;
        }
        setPdfData(bytes);
        onLoadPdfData?.(bytes);
      })
      .catch((error: any) => {
        if (cancelled) return;
        const phase: PdfDiagnostics["errorPhase"] = error?.__phase || "fetch";
        const errDiag: PdfDiagnostics = {
          ...baseDiag,
          ...(error?.__http || {}),
          totalMs: Math.round(performance.now() - t0),
          errorPhase: phase,
          errorName: error?.name || "Error",
          errorMessage: error?.message || String(error),
          errorStack: typeof error?.stack === "string" ? error.stack.split("\n").slice(0, 6).join("\n") : undefined,
        };
        pushDiag(errDiag);
        setStatus("error");
        setDiagOpen(true);
      });

    return () => { cancelled = true; };
  }, [url, onLoadPdfData, pushDiag]);

  useEffect(() => {
    if (!pdfData || !containerWidth || !pagesRef.current) return;

    let cancelled = false;
    let pdfDocument: PDFDocumentProxy | null = null;
    const pagesNode = pagesRef.current;
    const tParse0 = performance.now();

    const renderPdf = async () => {
      setStatus("loading");
      pagesNode.replaceChildren();
      pageElementsRef.current = [];

      try {
        const loadingTask = getDocument({ data: new Uint8Array(pdfData) });
        pdfDocument = await loadingTask.promise;
        const parseMs = Math.round(performance.now() - tParse0);
        setNumPages(pdfDocument.numPages);
        const tRender0 = performance.now();
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
          canvas.dataset.pageNumber = String(pageNumber);

          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
          await page.render({ canvasContext: context, viewport }).promise;

          if (cancelled) return;
          pagesNode.appendChild(canvas);
          pageElementsRef.current.push(canvas);
          page.cleanup();
        }

        if (!cancelled) {
          const renderMs = Math.round(performance.now() - tRender0);
          setStatus("ready");
          setDiag((prev) => {
            const next: PdfDiagnostics = {
              ...(prev || { url, urlKind: classifyUrl(url), startedAt: new Date().toISOString() }),
              parseMs,
              renderMs,
              numPages: pdfDocument?.numPages,
              totalMs: (prev?.fetchMs || 0) + parseMs + renderMs,
            };
            window.setTimeout(() => onDiagnostics?.(next), 0);
            // eslint-disable-next-line no-console
            console.info("[PDF-Preview] render ok", next);
            return next;
          });
        }
      } catch (error: any) {
        console.error("PDF preview render failed", error);
        if (!cancelled) {
          setDiag((prev) => {
            const phase: PdfDiagnostics["errorPhase"] = error?.__phase || "render";
            const next: PdfDiagnostics = {
              ...(prev || { url, urlKind: classifyUrl(url), startedAt: new Date().toISOString() }),
              errorPhase: phase,
              errorName: error?.name || "Error",
              errorMessage: error?.message || String(error),
              errorStack: typeof error?.stack === "string" ? error.stack.split("\n").slice(0, 6).join("\n") : undefined,
            };
            window.setTimeout(() => onDiagnostics?.(next), 0);
            return next;
          });
          setStatus("error");
          setDiagOpen(true);
        }
      }
    };

    renderPdf();

    return () => {
      cancelled = true;
      pagesNode.replaceChildren();
      pageElementsRef.current = [];
      pdfDocument?.destroy();
    };
  }, [pdfData, containerWidth, zoom, onDiagnostics, url]);

  // Track current page during scroll
  useEffect(() => {
    const node = containerRef.current;
    if (!node || status !== "ready") return;
    const onScroll = () => {
      const els = pageElementsRef.current;
      if (!els.length) return;
      const containerTop = node.getBoundingClientRect().top;
      let active = 1;
      for (const el of els) {
        const rect = el.getBoundingClientRect();
        if (rect.top - containerTop <= node.clientHeight / 3) {
          active = Number(el.dataset.pageNumber || "1");
        } else break;
      }
      setCurrentPage(active);
      setPageInput(String(active));
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, [status, numPages]);

  const goToPage = useCallback((page: number) => {
    const target = Math.min(Math.max(1, page), numPages || 1);
    const el = pageElementsRef.current[target - 1];
    const node = containerRef.current;
    if (el && node) {
      node.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
      setCurrentPage(target);
      setPageInput(String(target));
    }
  }, [numPages]);

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

  const submitPageInput = () => {
    const raw = pageInput.trim();
    if (raw === "") {
      setPageInputError("Bitte eine Seitenzahl eingeben.");
      toast.error("Bitte eine Seitenzahl eingeben.");
      setPageInput(String(currentPage));
      return;
    }
    if (!/^\d+$/.test(raw)) {
      setPageInputError("Nur ganze Zahlen erlaubt.");
      toast.error("Ungültige Seitenzahl: nur ganze Zahlen erlaubt.");
      setPageInput(String(currentPage));
      return;
    }
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > numPages) {
      const msg = numPages > 0
        ? `Seitenzahl muss zwischen 1 und ${numPages} liegen.`
        : "Keine Seiten verfügbar.";
      setPageInputError(msg);
      toast.error(msg);
      setPageInput(String(currentPage));
      return;
    }
    setPageInputError(null);
    goToPage(n);
  };

  const onPageInputChange = (value: string) => {
    setPageInput(value.replace(/[^0-9]/g, ""));
    if (pageInputError) setPageInputError(null);
  };

  const copyDiagnostics = async () => {
    if (!diag) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(diag, null, 2));
      toast.success("Diagnose in die Zwischenablage kopiert.");
    } catch {
      toast.error("Konnte Diagnose nicht kopieren.");
    }
  };

  const phaseLabel = (p?: PdfDiagnostics["errorPhase"]) =>
    p === "fetch" ? "Laden (HTTP)" : p === "parse" ? "PDF einlesen" : p === "render" ? "Rendering" : "–";

  return (
    <div className="relative h-full flex flex-col bg-muted">
      {/* Page navigation */}
      <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-md border border-border bg-background/90 p-1 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1 || status !== "ready"}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-foreground hover:bg-muted disabled:opacity-40"
          aria-label="Vorherige Seite"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={pageInput}
          onChange={(e) => onPageInputChange(e.target.value)}
          onBlur={submitPageInput}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitPageInput(); } }}
          className={`h-8 w-10 rounded border bg-background text-center text-xs tabular-nums text-foreground focus:outline-none focus:ring-1 ${pageInputError ? "border-destructive ring-destructive focus:ring-destructive" : "border-border focus:ring-ring"}`}
          aria-label="Seitenzahl"
          aria-invalid={pageInputError ? true : undefined}
          aria-errormessage={pageInputError ? "page-input-error" : undefined}
          title={pageInputError ?? undefined}
          disabled={status !== "ready"}
        />
        <span className="px-1 text-xs tabular-nums text-muted-foreground">
          / {numPages || "–"}
        </span>
        <button
          type="button"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= numPages || status !== "ready"}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-foreground hover:bg-muted disabled:opacity-40"
          aria-label="Nächste Seite"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Zoom controls */}
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
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-md border border-destructive/40 bg-background shadow-lg">
              <div className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-destructive">PDF-Vorschau fehlgeschlagen</h3>
                <p className="text-xs text-muted-foreground">
                  Phase: <span className="font-medium text-foreground">{phaseLabel(diag?.errorPhase)}</span>
                  {diag?.httpStatus !== undefined && (
                    <> · HTTP <span className="font-medium text-foreground">{diag.httpStatus} {diag.httpStatusText}</span></>
                  )}
                  {typeof diag?.fetchMs === "number" && (
                    <> · Ladezeit <span className="font-medium text-foreground">{diag.fetchMs} ms</span></>
                  )}
                </p>
                {diag?.errorMessage && (
                  <p className="text-xs text-destructive break-words">{diag.errorMessage}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setDiagOpen((v) => !v)}
                    className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-1 text-xs hover:bg-accent"
                  >
                    {diagOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    Details {diagOpen ? "verbergen" : "anzeigen"}
                  </button>
                  <button
                    type="button"
                    onClick={copyDiagnostics}
                    className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-1 text-xs hover:bg-accent"
                  >
                    <Copy className="h-3 w-3" /> Diagnose kopieren
                  </button>
                </div>
                {diagOpen && diag && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-2 text-[10px] leading-relaxed text-foreground whitespace-pre-wrap break-all">
{JSON.stringify(diag, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}
        <div ref={pagesRef} className="space-y-3 pt-12" aria-hidden={status !== "ready"} />
      </div>
    </div>
  );
}
