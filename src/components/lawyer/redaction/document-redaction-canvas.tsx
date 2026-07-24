'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Trash2, Square, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadPdfFromUrl, type LoadedPdf } from '@/lib/redaction/pdf-render-client';

interface RedactionBox {
  id: string;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  mode: 'draft' | 'burned';
  category: 'pii' | 'financial' | 'privilege' | 'manual';
}

interface DocumentRedactionCanvasProps {
  caseId: string;
  documentId: string;
  fileName: string;
  locale: string;
}

const CANVAS_WIDTH = 760;

export function DocumentRedactionCanvas({ caseId, documentId, fileName, locale }: DocumentRedactionCanvasProps) {
  const isRTL = locale === 'ar';

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pdfRef     = useRef<LoadedPdf | null>(null);

  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [numPages, setNumPages]     = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 });

  const [boxes, setBoxes]           = useState<RedactionBox[]>([]);
  const [saving, setSaving]         = useState(false);
  const [detecting, setDetecting]   = useState(false);
  const [detectMessage, setDetectMessage] = useState<string | null>(null);

  // in-progress drag
  const [dragStart, setDragStart]   = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  const loadBoxes = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}/documents/${documentId}/redactions`);
    if (res.ok) setBoxes(await res.json());
  }, [caseId, documentId]);

  // Load the PDF once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const urlRes = await fetch(`/api/cases/${caseId}/documents/${documentId}/view-url`);
        const urlData = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlData.error);

        const pdf = await loadPdfFromUrl(urlData.url);
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        await loadBoxes();
      } catch (e) {
        if (!cancelled) setError(isRTL ? 'تعذّر تحميل المستند. هل هو ملف PDF؟' : 'Could not load the document. Is it a PDF?');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, documentId]);

  // Render current page whenever it changes (after the PDF is loaded)
  useEffect(() => {
    if (!pdfRef.current || !canvasRef.current || loading) return;
    pdfRef.current.renderPage(currentPage, canvasRef.current, CANVAS_WIDTH).then(setRenderSize);
  }, [currentPage, loading]);

  const pageBoxes = boxes.filter((b) => b.page_number === currentPage);

  function relativePos(e: React.MouseEvent) {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1),
    };
  }

  const onMouseDown = (e: React.MouseEvent) => {
    if (renderSize.width === 0) return;
    setDragStart(relativePos(e));
    setDragCurrent(relativePos(e));
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragStart) return;
    setDragCurrent(relativePos(e));
  };
  const onMouseUp = async () => {
    if (!dragStart || !dragCurrent) { setDragStart(null); setDragCurrent(null); return; }

    const x = Math.min(dragStart.x, dragCurrent.x);
    const y = Math.min(dragStart.y, dragCurrent.y);
    const width  = Math.abs(dragCurrent.x - dragStart.x);
    const height = Math.abs(dragCurrent.y - dragStart.y);
    setDragStart(null);
    setDragCurrent(null);

    // Ignore accidental clicks/tiny drags
    if (width < 0.01 || height < 0.01) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/documents/${documentId}/redactions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ page_number: currentPage, x, y, width, height, category: 'manual' }),
      });
      if (res.ok) loadBoxes();
    } finally {
      setSaving(false);
    }
  };

  const deleteBox = async (boxId: string) => {
    setBoxes((prev) => prev.filter((b) => b.id !== boxId)); // optimistic
    await fetch(`/api/cases/${caseId}/documents/${documentId}/redactions/${boxId}`, { method: 'DELETE' });
  };

  const runDetection = async () => {
    setDetecting(true);
    setDetectMessage(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/documents/${documentId}/redactions/detect`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetectMessage(
        isRTL
          ? `تم اقتراح ${data.created} تظليل — راجعها واحذف غير المناسب.`
          : `${data.created} suggested redaction${data.created !== 1 ? 's' : ''} found — review and remove any that don't apply.`
      );
      await loadBoxes();
    } catch (e) {
      setDetectMessage(String(e));
    } finally {
      setDetecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground truncate">{fileName}</h1>
          <p className="text-xs text-muted-foreground">
            {isRTL ? 'وضع المسودة — التظليل مؤقت وقابل للتعديل' : 'Draft mode — highlights are temporary and editable'}
          </p>
        </div>
        {numPages > 1 && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-lg border border-border p-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground" dir="ltr">{currentPage} / {numPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage >= numPages}
              className="rounded-lg border border-border p-1.5 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Square className="h-3 w-3" />
          {isRTL ? 'اضغط واسحب فوق المستند لإنشاء تظليل' : 'Click and drag over the document to draw a redaction box'}
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
        </p>
        <button
          onClick={runDetection}
          disabled={detecting}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1A3557] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#1e4a7a] disabled:opacity-50"
        >
          {detecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {isRTL ? 'تشغيل الكشف الآلي' : 'Run AI Detection'}
        </button>
      </div>

      {detectMessage && (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{detectMessage}</p>
      )}

      <div className="flex justify-center rounded-2xl border border-border bg-muted/20 p-4">
        <div
          className="relative select-none"
          style={{ width: renderSize.width || CANVAS_WIDTH, height: renderSize.height || 'auto' }}
        >
          <canvas ref={canvasRef} className="block rounded-lg shadow-sm" />
          <div
            ref={overlayRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            className="absolute inset-0 cursor-crosshair"
          >
            {pageBoxes.map((box) => (
              <div
                key={box.id}
                className={cn(
                  'group absolute border-2',
                  box.mode === 'burned' ? 'border-black bg-black' : 'border-amber-500 bg-amber-400/50'
                )}
                style={{
                  left:   `${box.x * 100}%`,
                  top:    `${box.y * 100}%`,
                  width:  `${box.width * 100}%`,
                  height: `${box.height * 100}%`,
                }}
              >
                {box.mode === 'draft' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteBox(box.id); }}
                    className="absolute -end-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white group-hover:flex"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                {box.mode === 'draft' && box.category !== 'manual' && (
                  <span className="absolute -top-4 start-0 whitespace-nowrap rounded bg-[#1A3557] px-1 text-[8px] font-bold text-white">
                    {box.category}
                  </span>
                )}
              </div>
            ))}

            {dragStart && dragCurrent && (
              <div
                className="absolute border-2 border-dashed border-amber-600 bg-amber-400/30"
                style={{
                  left:   `${Math.min(dragStart.x, dragCurrent.x) * 100}%`,
                  top:    `${Math.min(dragStart.y, dragCurrent.y) * 100}%`,
                  width:  `${Math.abs(dragCurrent.x - dragStart.x) * 100}%`,
                  height: `${Math.abs(dragCurrent.y - dragStart.y) * 100}%`,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {pageBoxes.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {pageBoxes.length} {isRTL ? `تظليل على هذه الصفحة` : `redaction${pageBoxes.length !== 1 ? 's' : ''} on this page`}
        </p>
      )}
    </div>
  );
}
