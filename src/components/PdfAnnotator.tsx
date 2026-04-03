'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MousePointer,
  Type,
  Check,
  X,
  PenLine,
  Trash2,
  Download,
  ArrowLeft,
  Minus,
  Plus,
  Layers,
  RotateCcw,
  Save,
} from 'lucide-react';
import type { Annotation, ToolType, PageData } from '@/lib/types';
import SignaturePad from './SignaturePad';
import { loadEngines, exportAnnotatedPdf } from '@/lib/pdf-engine';

/* ── Types ─────────────────────────────────────────────────── */

interface Props {
  pdfBytes: Uint8Array;
  fileName: string;
  onBack: () => void;
  initialAnnotations?: Annotation[];
}

interface DragInfo {
  type: 'move' | 'resize';
  id: string;
  startMouseX: number;
  startMouseY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
}

let idCounter = 0;
function uid() {
  return 'a' + (++idCounter) + Math.random().toString(36).slice(2, 6);
}

/* ── Component ─────────────────────────────────────────────── */

export default function PdfAnnotator({ pdfBytes, fileName, onBack, initialAnnotations }: Props) {
  const [pages, setPages] = useState<PageData[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations || []);
  const [tool, setTool] = useState<ToolType>('text');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(14);
  const [markSize, setMarkSize] = useState(22);
  const [showSigPad, setShowSigPad] = useState(false);
  const [sigData, setSigData] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Annotation[][]>([]);

  /* ── Render PDF pages ────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadEngines();
      const pdfjsModule = await import('pdfjs-dist');
      const doc = await pdfjsModule.getDocument({
        data: new Uint8Array(pdfBytes),
      }).promise;

      const containerWidth = Math.min(window.innerWidth - 48, 900);
      const pageList: PageData[] = [];

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        const displayScale = containerWidth / vp.width;
        const hiDpi = 2;
        const renderVp = page.getViewport({ scale: displayScale * hiDpi });

        const canvas = document.createElement('canvas');
        canvas.width = renderVp.width;
        canvas.height = renderVp.height;
        await page.render({
          canvasContext: canvas.getContext('2d')!,
          viewport: renderVp,
        }).promise;

        pageList.push({
          pageNum: i,
          dataUrl: canvas.toDataURL('image/png'),
          displayWidth: vp.width * displayScale,
          displayHeight: vp.height * displayScale,
          pdfWidth: vp.width,
          pdfHeight: vp.height,
          scale: displayScale,
        });
      }

      if (!cancelled) {
        setPages(pageList);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfBytes]);

  /* ── Drag: global mouse handlers ─────────────────────────── */

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - drag.startMouseX;
      const dy = e.clientY - drag.startMouseY;
      setAnnotations((prev) =>
        prev.map((a) => {
          if (a.id !== drag.id) return a;
          if (drag.type === 'move') {
            return { ...a, x: drag.origX + dx, y: drag.origY + dy };
          }
          return {
            ...a,
            width: Math.max(16, drag.origW + dx),
            height: Math.max(10, drag.origH + dy),
          };
        }),
      );
    };

    const onUp = () => setDrag(null);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag]);

  /* ── Helpers ─────────────────────────────────────────────── */

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-30), annotations]);
  }, [annotations]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setAnnotations(prev);
      return h.slice(0, -1);
    });
  }, []);

  const addAnnotation = useCallback(
    (partial: Omit<Annotation, 'id'>) => {
      pushHistory();
      const id = uid();
      setAnnotations((prev) => [...prev, { id, ...partial }]);
      setSelectedId(id);
    },
    [pushHistory],
  );

  const updateAnnotation = useCallback(
    (id: string, updates: Partial<Annotation>) => {
      setAnnotations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...updates } : a)),
      );
    },
    [],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    pushHistory();
    setAnnotations((prev) => prev.filter((a) => a.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, pushHistory]);

  /* ── Page click → place annotation ───────────────────────── */

  const handlePageClick = useCallback(
    (pageNum: number, e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-ann]')) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (tool === 'select') {
        setSelectedId(null);
        return;
      }
      if (tool === 'text') {
        addAnnotation({
          type: 'text',
          page: pageNum,
          x,
          y: y - fontSize / 2,
          width: 200,
          height: fontSize + 6,
          fontSize,
          content: '',
        });
      } else if (tool === 'check') {
        addAnnotation({
          type: 'check',
          page: pageNum,
          x: x - markSize / 2,
          y: y - markSize / 2,
          width: markSize,
          height: markSize,
        });
      } else if (tool === 'cross') {
        addAnnotation({
          type: 'cross',
          page: pageNum,
          x: x - markSize / 2,
          y: y - markSize / 2,
          width: markSize,
          height: markSize,
        });
      } else if (tool === 'strikeout') {
        addAnnotation({
          type: 'strikeout',
          page: pageNum,
          x,
          y: y - 1,
          width: 150,
          height: 3,
        });
      } else if (tool === 'signature') {
        if (sigData) {
          addAnnotation({
            type: 'signature',
            page: pageNum,
            x,
            y,
            width: 160,
            height: 64,
            imageData: sigData,
          });
        } else {
          setShowSigPad(true);
        }
      }
    },
    [tool, fontSize, markSize, sigData, addAnnotation],
  );

  /* ── Annotation mouse handlers ───────────────────────────── */

  const handleAnnotClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
  };

  const startMove = (e: React.MouseEvent, ann: Annotation) => {
    e.stopPropagation();
    e.preventDefault();
    pushHistory();
    setDrag({
      type: 'move',
      id: ann.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origX: ann.x,
      origY: ann.y,
      origW: ann.width,
      origH: ann.height,
    });
    setSelectedId(ann.id);
  };

  const startResize = (e: React.MouseEvent, ann: Annotation) => {
    e.stopPropagation();
    e.preventDefault();
    pushHistory();
    setDrag({
      type: 'resize',
      id: ann.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origX: ann.x,
      origY: ann.y,
      origW: ann.width,
      origH: ann.height,
    });
  };

  /* ── Keyboard shortcuts ──────────────────────────────────── */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if (e.key === 'Escape') setSelectedId(null);
      if (e.ctrlKey && e.key === 'z') undo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelected, undo]);

  /* ── Download ────────────────────────────────────────────── */

  const handleDownload = async () => {
    setSaving(true);
    try {
      const result = await exportAnnotatedPdf(pdfBytes, annotations, pages);
      const blob = new Blob([result.buffer as ArrayBuffer], {
        type: 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `filled_${fileName}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
    setSaving(false);
  };
  const handleSaveProgress = () => {
    const chunkSize = 8192;
    let binary = '';
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      binary += String.fromCharCode(...pdfBytes.subarray(i, i + chunkSize));
    }
    const saveData = JSON.stringify({
      version: 1,
      fileName,
      pdfBase64: btoa(binary),
      annotations,
    });
    const blob = new Blob([saveData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.pdf$/i, '') + '.fillbuddy';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  /* ── Toolbar config ──────────────────────────────────────── */

  const tools: { id: ToolType; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: <MousePointer size={16} />, label: 'Select' },
    { id: 'text', icon: <Type size={16} />, label: 'Text' },
    { id: 'check', icon: <Check size={16} />, label: 'Tick' },
    { id: 'cross', icon: <X size={16} />, label: 'Cross' },
    { id: 'strikeout', icon: <Minus size={16} />, label: 'Strike' },
    { id: 'signature', icon: <PenLine size={16} />, label: 'Sign' },
  ];

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-600 to-amber-400 flex items-center justify-center">
                <Layers size={14} className="text-black" strokeWidth={2.5} />
              </div>
              <span className="font-heading font-bold text-gray-900 hidden sm:inline">
                FillBuddy
              </span>
            </div>
          </div>

          <div className="text-sm text-gray-500 hidden md:block truncate max-w-[200px]">
            {fileName}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveProgress}
              className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
              title="Save progress to continue later"
            >
              <Save size={16} /> Save
            </button>
            <button
              onClick={handleDownload}
              disabled={saving}
              className="flex items-center gap-1.5 bg-amber-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              <Download size={16} /> {saving ? 'Saving...' : 'Download PDF'}
            </button>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="border-t bg-gray-50 px-4 py-2">
          <div className="flex items-center gap-1.5 max-w-5xl mx-auto flex-wrap">
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  if (t.id === 'signature' && !sigData) {
                    setShowSigPad(true);
                    return;
                  }
                  setTool(t.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tool === t.id
                    ? 'bg-amber-100 text-amber-800'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}

            {sigData && tool === 'signature' && (
              <button
                onClick={() => setShowSigPad(true)}
                className="text-xs text-amber-700 underline ml-1"
              >
                change
              </button>
            )}

            <div className="w-px h-6 bg-gray-300 mx-1" />

            {/* Font size */}
            {tool === 'text' && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Font:</span>
                <button
                  onClick={() => setFontSize((s) => Math.max(8, s - 1))}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <Minus size={14} />
                </button>
                <span className="text-sm font-mono w-6 text-center">
                  {fontSize}
                </span>
                <button
                  onClick={() => setFontSize((s) => Math.min(48, s + 1))}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}

            {/* Mark size */}
            {(tool === 'check' || tool === 'cross') && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Size:</span>
                <button
                  onClick={() => setMarkSize((s) => Math.max(10, s - 2))}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <Minus size={14} />
                </button>
                <span className="text-sm font-mono w-6 text-center">
                  {markSize}
                </span>
                <button
                  onClick={() => setMarkSize((s) => Math.min(60, s + 2))}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}

            {/* Selected annotation font-size adjustment */}
            {selectedId &&
              (() => {
                const sel = annotations.find((a) => a.id === selectedId);
                return sel?.type === 'text' ? (
                  <div className="flex items-center gap-1 ml-2">
                    <span className="text-xs text-blue-600">Size:</span>
                    <button
                      onClick={() =>
                        updateAnnotation(sel.id, {
                          fontSize: Math.max(8, (sel.fontSize || 14) - 1),
                        })
                      }
                      className="p-1 hover:bg-blue-100 rounded text-blue-600"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-sm font-mono w-6 text-center text-blue-600">
                      {sel.fontSize || 14}
                    </span>
                    <button
                      onClick={() =>
                        updateAnnotation(sel.id, {
                          fontSize: Math.min(48, (sel.fontSize || 14) + 1),
                        })
                      }
                      className="p-1 hover:bg-blue-100 rounded text-blue-600"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ) : null;
              })()}

            <div className="flex-1" />

            {/* Undo */}
            <button
              onClick={undo}
              disabled={!history.length}
              className="p-1.5 hover:bg-gray-200 rounded text-gray-500 disabled:opacity-30"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw size={16} />
            </button>

            {/* Delete */}
            {selectedId && (
              <button
                onClick={deleteSelected}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Pages ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-[3px] border-amber-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="py-6 space-y-6">
          {pages.map((pg) => (
            <div key={pg.pageNum} className="flex justify-center px-4">
              <div
                className="relative shadow-lg bg-white"
                style={{ width: pg.displayWidth, height: pg.displayHeight }}
                onClick={(e) => handlePageClick(pg.pageNum, e)}
              >
                {/* PDF page image */}
                <img
                  src={pg.dataUrl}
                  alt={`Page ${pg.pageNum}`}
                  className="w-full h-full pointer-events-none select-none"
                  draggable={false}
                />

                {/* Annotation overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    cursor:
                      tool === 'select' ? 'default' : 'crosshair',
                  }}
                >
                  {annotations
                    .filter((a) => a.page === pg.pageNum)
                    .map((ann) => {
                      const isSelected = selectedId === ann.id;

                      return (
                        <div
                          key={ann.id}
                          data-ann
                          className={`absolute ${
                            isSelected
                              ? 'ring-2 ring-blue-500 ring-offset-1 z-20'
                              : 'hover:ring-1 hover:ring-blue-300 z-10'
                          }`}
                          style={{
                            left: ann.x,
                            top: ann.y,
                            width: ann.width,
                            height:
                              ann.type === 'text' ? 'auto' : ann.height,
                            minHeight:
                              ann.type === 'text' ? ann.height : undefined,
                          }}
                          onClick={(e) => handleAnnotClick(e, ann.id)}
                          onMouseDown={(e) => {
                            if (ann.type !== 'text' || !isSelected) {
                              startMove(e, ann);
                            }
                          }}
                        >
                          {/* ── Text ── */}
                          {ann.type === 'text' &&
                            (isSelected ? (
                              <textarea
                                value={ann.content || ''}
                                onChange={(e) => {
                                  updateAnnotation(ann.id, {
                                    content: e.target.value,
                                  });
                                  e.currentTarget.style.height = 'auto';
                                  e.currentTarget.style.height =
                                    e.currentTarget.scrollHeight + 'px';
                                }}
                                ref={(el) => {
                                  if (el) {
                                    el.style.height = 'auto';
                                    el.style.height =
                                      el.scrollHeight + 'px';
                                  }
                                }}
                                style={{
                                  fontSize: (ann.fontSize || 14) + 'px',
                                  lineHeight: '1.3',
                                }}
                                className="w-full bg-transparent outline-none resize-none text-black"
                                rows={1}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <div
                                style={{
                                  fontSize: (ann.fontSize || 14) + 'px',
                                  lineHeight: '1.3',
                                }}
                                className="text-black whitespace-pre-wrap break-words"
                              >
                                {ann.content || ''}
                              </div>
                            ))}

                          {/* ── Check ✓ ── */}
                          {ann.type === 'check' && (
                            <svg
                              viewBox="0 0 24 24"
                              className="w-full h-full"
                              fill="none"
                              stroke="black"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}

                          {/* ── Cross ✗ ── */}
                          {ann.type === 'cross' && (
                            <svg
                              viewBox="0 0 24 24"
                              className="w-full h-full"
                              fill="none"
                              stroke="black"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          )}

                          {/* ── Strikeout ── */}
                          {ann.type === 'strikeout' && (
                            <div className="w-full h-full bg-black" />
                          )}

                          {/* ── Signature ── */}
                          {ann.type === 'signature' && ann.imageData && (
                            <img
                              src={ann.imageData}
                              alt="Signature"
                              className="w-full h-full object-contain pointer-events-none"
                              draggable={false}
                            />
                          )}

                          {/* ── Move handle for text (when selected) ── */}
                          {isSelected && ann.type === 'text' && (
                            <div
                              className="absolute -top-3 -left-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center cursor-move shadow"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                startMove(e, ann);
                              }}
                              title="Drag to move"
                            >
                              <svg
                                viewBox="0 0 16 16"
                                className="w-3 h-3 text-white"
                                fill="currentColor"
                              >
                                <circle cx="4" cy="4" r="1.5" />
                                <circle cx="4" cy="8" r="1.5" />
                                <circle cx="8" cy="4" r="1.5" />
                                <circle cx="8" cy="8" r="1.5" />
                              </svg>
                            </div>
                          )}

                          {/* ── Resize handle ── */}
                          {isSelected && (
                            <div
                              className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-500 rounded-sm cursor-se-resize shadow"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                startResize(e, ann);
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Page number badge */}
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded pointer-events-none">
                  Page {pg.pageNum}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Signature pad modal ── */}
      {showSigPad && (
        <SignaturePad
          onSave={(data) => {
            setSigData(data);
            setShowSigPad(false);
            setTool('signature');
          }}
          onCancel={() => setShowSigPad(false)}
        />
      )}
    </div>
  );
}
