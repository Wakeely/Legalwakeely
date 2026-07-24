'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { getDocumentSignedUrl } from '@/lib/storage-helpers';

// Configure the PDF worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Redaction {
  id?: string;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  category: string;
  mode: 'draft' | 'burned';
}

interface RedactionCanvasProps {
  documentId: string;
  filePath: string;
  onClose: () => void;
  onSave?: () => void;
}

export default function RedactionCanvas({ documentId, filePath, onClose, onSave }: RedactionCanvasProps) {
  const [redactions, setRedactions] = useState<Redaction[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drawing state
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [scale, setScale] = useState(1);

  // 1. Fetch existing redactions
  useEffect(() => {
    const fetchRedactions = async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/redactions`);
        if (res.ok) {
          const data = await res.json();
          setRedactions(data.filter((r: Redaction) => r.mode === 'draft'));
        }
      } catch (err) {
        console.error('Failed to fetch redactions:', err);
      }
    };
    fetchRedactions();
  }, [documentId]);

  // 2. Load PDF
  useEffect(() => {
    const loadPdf = async () => {
      setIsLoading(true);
      try {
        const signedUrl = await getDocumentSignedUrl(filePath);
        if (!signedUrl) throw new Error('Failed to get signed URL');

        const loadingTask = pdfjsLib.getDocument(signedUrl);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
      } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Could not load document.');
      } finally {
        setIsLoading(false);
      }
    };
    loadPdf();
  }, [filePath]);

  // 3. Render current page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !overlayCanvasRef.current) return;

    const page = await pdfDoc.getPage(currentPage);
    const viewport = page.getViewport({ scale: 1 });

    // Fit to container width
    const container = containerRef.current;
    if (!container) return;
    const containerWidth = container.clientWidth - 32; // padding
    const newScale = containerWidth / viewport.width;
    setScale(newScale);

    const scaledViewport = page.getViewport({ scale: newScale });

    // Main canvas
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    const renderContext = {
      canvasContext: ctx,
      viewport: scaledViewport,
    };
    await page.render(renderContext).promise;

    // Overlay canvas (transparent for drawing)
    const overlayCanvas = overlayCanvasRef.current;
    const overlayCtx = overlayCanvas.getContext('2d')!;
    overlayCanvas.width = scaledViewport.width;
    overlayCanvas.height = scaledViewport.height;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Draw existing redactions on overlay
    const pageRedactions = redactions.filter(r => r.page_number === currentPage);
    pageRedactions.forEach(r => {
      overlayCtx.fillStyle = 'rgba(255, 255, 0, 0.4)';
      overlayCtx.strokeStyle = '#eab308';
      overlayCtx.lineWidth = 2;
      const x = r.x * overlayCanvas.width;
      const y = r.y * overlayCanvas.height;
      const w = r.width * overlayCanvas.width;
      const h = r.height * overlayCanvas.height;
      overlayCtx.fillRect(x, y, w, h);
      overlayCtx.strokeRect(x, y, w, h);
    });

    // Draw current drawing rect
    if (currentRect) {
      overlayCtx.fillStyle = 'rgba(255, 255, 0, 0.4)';
      overlayCtx.strokeStyle = '#eab308';
      overlayCtx.lineWidth = 2;
      const x = currentRect.x * overlayCanvas.width;
      const y = currentRect.y * overlayCanvas.height;
      const w = currentRect.width * overlayCanvas.width;
      const h = currentRect.height * overlayCanvas.height;
      overlayCtx.fillRect(x, y, w, h);
      overlayCtx.strokeRect(x, y, w, h);
    }
  }, [pdfDoc, currentPage, redactions, currentRect]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Mouse event handlers for drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const x = (e.clientX - rect.left) / overlay.width;
    const y = (e.clientY - rect.top) / overlay.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;

    setIsDrawing(true);
    setStartPos({ x, y });
    setCurrentRect({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos || !overlayCanvasRef.current) return;
    const overlay = overlayCanvasRef.current;
    const rect = overlay.getBoundingClientRect();
    const x = (e.clientX - rect.left) / overlay.width;
    const y = (e.clientY - rect.top) / overlay.height;

    const clampedX = Math.max(0, Math.min(1, x));
    const clampedY = Math.max(0, Math.min(1, y));

    const width = clampedX - startPos.x;
    const height = clampedY - startPos.y;

    setCurrentRect({
      x: width > 0 ? startPos.x : clampedX,
      y: height > 0 ? startPos.y : clampedY,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  };

  const handleMouseUp = async () => {
    if (!isDrawing || !currentRect || !documentId) {
      setIsDrawing(false);
      setStartPos(null);
      setCurrentRect(null);
      return;
    }

    // Save the redaction
    if (currentRect.width > 0.01 && currentRect.height > 0.01) {
      try {
        const res = await fetch(`/api/documents/${documentId}/redactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            page_number: currentPage,
            x: currentRect.x,
            y: currentRect.y,
            width: currentRect.width,
            height: currentRect.height,
            category: 'manual',
          }),
        });
        if (res.ok) {
          const newRedaction = await res.json();
          setRedactions(prev => [...prev, newRedaction]);
        }
      } catch (err) {
        console.error('Failed to save redaction:', err);
      }
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentRect(null);
  };

  // Delete a redaction
  const handleDeleteRedaction = async (redactionId: string) => {
    if (!confirm('Delete this redaction?')) return;
    try {
      const res = await fetch(`/api/documents/${documentId}/redactions/${redactionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setRedactions(prev => prev.filter(r => r.id !== redactionId));
      }
    } catch (err) {
      console.error('Failed to delete redaction:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-xl">
          <p className="text-lg">Loading document...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-lg font-semibold">Document Redaction</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={onClose}
              className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div ref={containerRef} className="flex-1 overflow-auto p-4 bg-gray-100">
          <div className="relative inline-block">
            <canvas ref={canvasRef} className="border border-gray-300" />
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-between items-center shrink-0">
          <div className="text-sm text-gray-500">
            {redactions.filter(r => r.page_number === currentPage).length} redactions on this page
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
