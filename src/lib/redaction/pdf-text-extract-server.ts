import 'server-only';

/**
 * Extracts text per page from a PDF buffer, along with enough position
 * data to map a regex match back to a bounding box on the page.
 *
 * Uses pdfjs-dist's Node-compatible "legacy" build (no DOM/worker
 * required), separate from lib/redaction/pdf-render-client.ts which is the
 * browser-side renderer used by the canvas — different entry points for
 * the same library, same as pdfjs-dist's own documented split.
 */

interface TextItemPosition {
  str: string;
  offsetStart: number; // character offset into the page's concatenated text
  offsetEnd: number;
  // normalized 0–1, top-left origin (matches document_redactions schema)
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageTextData {
  pageNumber: number;
  text: string;
  items: TextItemPosition[];
}

export async function extractPdfTextWithPositions(pdfBuffer: Buffer): Promise<PageTextData[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;

  const pages: PageTextData[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const { width: pageWidth, height: pageHeight } = viewport;

    const textContent = await page.getTextContent();
    let cursor = 0;
    let text = '';
    const items: TextItemPosition[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of textContent.items as any[]) {
      const str: string = item.str ?? '';
      if (!str) continue;

      // item.transform = [a, b, c, d, e, f] — e,f is the text origin in PDF
      // user space (bottom-left = 0,0). item.width/height are already in
      // that same unscaled space at scale=1.
      const [, , , , e, f] = item.transform;
      const itemWidth: number = item.width ?? 0;
      const itemHeight: number = item.height ?? (Math.abs(item.transform[3]) || 10);

      // Flip PDF's bottom-left origin to top-left, then normalize 0–1.
      const xNorm = e / pageWidth;
      const yNorm = (pageHeight - (f + itemHeight)) / pageHeight;
      const wNorm = itemWidth / pageWidth;
      const hNorm = itemHeight / pageHeight;

      const offsetStart = cursor;
      text += str + ' ';
      cursor = text.length;

      items.push({
        str,
        offsetStart,
        offsetEnd: offsetStart + str.length,
        x: Math.max(0, Math.min(1, xNorm)),
        y: Math.max(0, Math.min(1, yNorm)),
        width: Math.max(0.0001, Math.min(1, wNorm)),
        height: Math.max(0.0001, Math.min(1, hNorm)),
      });
    }

    pages.push({ pageNumber, text, items });
  }

  return pages;
}

/**
 * Given a regex match's character range on a page, find every text item
 * that overlaps it and return the union bounding box. A match spanning
 * several text runs (common with pdf.js's per-run text items) still gets
 * one merged box rather than several fragments.
 */
export function boundingBoxForRange(
  page: PageTextData,
  matchStart: number,
  matchEnd: number
): { x: number; y: number; width: number; height: number } | null {
  const overlapping = page.items.filter(
    (item) => item.offsetStart < matchEnd && item.offsetEnd > matchStart
  );
  if (overlapping.length === 0) return null;

  const minX = Math.min(...overlapping.map((i) => i.x));
  const minY = Math.min(...overlapping.map((i) => i.y));
  const maxX = Math.max(...overlapping.map((i) => i.x + i.width));
  const maxY = Math.max(...overlapping.map((i) => i.y + i.height));

  return {
    x: minX,
    y: minY,
    width: Math.min(1 - minX, maxX - minX),
    height: Math.min(1 - minY, maxY - minY),
  };
}
