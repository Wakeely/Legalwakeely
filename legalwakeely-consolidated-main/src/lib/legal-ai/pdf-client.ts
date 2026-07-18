"use client";

/**
 * Client-side text extraction.
 * - PDFs: PDF.js (Mozilla) for embedded text
 * - Images: Tesseract.js for OCR (Arabic + English)
 */

let pdfjs: typeof import("pdfjs-dist") | null = null;
let pdfLoading: Promise<typeof import("pdfjs-dist")> | null = null;
let tesseractLoader: Promise<typeof import("tesseract.js")> | null = null;

async function loadPdfjs() {
  if (pdfjs) return pdfjs;
  if (pdfLoading) return pdfLoading;
  pdfLoading = (async () => {
    const lib = await import("pdfjs-dist");
    if (typeof window !== "undefined" && !lib.GlobalWorkerOptions.workerSrc) {
      lib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
    }
    pdfjs = lib;
    return lib;
  })();
  return pdfLoading;
}

async function loadTesseract() {
  if (tesseractLoader) return tesseractLoader;
  tesseractLoader = (async () => {
    const mod = await import("tesseract.js");
    return mod;
  })();
  return tesseractLoader;
}

export interface ExtractResult {
  text: string;
  pageCount: number;
  ok: boolean;
  error?: string;
}

export async function extractPdfText(file: File): Promise<ExtractResult> {
  try {
    const lib = await loadPdfjs();
    const buf = await file.arrayBuffer();
    const doc = await lib.getDocument({ data: buf }).promise;
    const pageCount = doc.numPages;
    const maxPages = Math.min(pageCount, 10);
    let text = "";
    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const strings: string[] = content.items
        .map((it) => ("str" in it ? (it as { str: string }).str : ""))
        .filter(Boolean);
      text += strings.join(" ") + "\n\n";
    }
    return { text: text.trim(), pageCount, ok: true };
  } catch (e: any) {
    return { text: "", pageCount: 0, ok: false, error: e?.message ?? "PDF extraction failed" };
  }
}

export async function extractImageText(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<ExtractResult> {
  try {
    const { createWorker } = await loadTesseract();
    // Arabic primary + English secondary; many Jordanian contracts mix both
    const worker = await createWorker(["ara", "eng"], 1, {
      logger: (m: { status: string; progress: number }) => {
        if (onProgress && m.status === "recognizing text" && typeof m.progress === "number") {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });
    const { data } = await worker.recognize(file);
    await worker.terminate();
    const text = (data?.text ?? "").trim();
    return { text, pageCount: 1, ok: text.length > 0 };
  } catch (e: any) {
    return { text: "", pageCount: 1, ok: false, error: e?.message ?? "OCR failed" };
  }
}
