'use client';

/**
 * Client-side PDF page rendering for the redaction canvas.
 * Mirrors the lazy-load + worker-setup pattern already used in
 * lib/legal-ai/pdf-client.ts, so both stay consistent and only ever
 * load pdfjs-dist once per page, client-side only (no SSR concerns).
 */

let pdfjs: typeof import('pdfjs-dist') | null = null;
let pdfLoading: Promise<typeof import('pdfjs-dist')> | null = null;

async function loadPdfjs() {
  if (pdfjs) return pdfjs;
  if (pdfLoading) return pdfLoading;
  pdfLoading = (async () => {
    const lib = await import('pdfjs-dist');
    if (typeof window !== 'undefined' && !lib.GlobalWorkerOptions.workerSrc) {
      lib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
    }
    pdfjs = lib;
    return lib;
  })();
  return pdfLoading;
}

export interface LoadedPdf {
  numPages: number;
  // Renders the given 1-indexed page onto the provided canvas at the given
  // CSS pixel width (height is derived from the page's own aspect ratio).
  // Returns the rendered size so the caller can position the draw-overlay
  // exactly on top of it.
  renderPage: (pageNumber: number, canvas: HTMLCanvasElement, targetWidth: number) => Promise<{ width: number; height: number }>;
}

export async function loadPdfFromUrl(url: string): Promise<LoadedPdf> {
  const lib = await loadPdfjs();
  const doc = await lib.getDocument({ url }).promise;

  return {
    numPages: doc.numPages,
    async renderPage(pageNumber, canvas, targetWidth) {
      const page = await doc.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = targetWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D context unavailable');

      await page.render({ canvasContext: context, viewport }).promise;
      return { width: viewport.width, height: viewport.height };
    },
  };
}
