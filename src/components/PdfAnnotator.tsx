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
  RotateCcw,
  Redo2,
  Save,
  Keyboard,
  Copy,
  CopyPlus,
  Palette,
  ArrowUpToLine,
  ArrowDownToLine,
  ClipboardPaste,
} from 'lucide-react';
import type { Annotation, ToolType, PageData } from '@/lib/types';
import SignaturePad from './SignaturePad';
import Logo from './Logo';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import { loadEngines, exportAnnotatedPdf } from '@/lib/pdf-engine';
import { trackEvent } from '@/lib/analytics/client';

/* ── Constants ─────────────────────────────────────────────── */

const COLOR_PRESETS = [
  '#000000', '#DC2626', '#2563EB', '#16A34A',
  '#9333EA', '#EA580C', '#CA8A04', '#0891B2',
  '#BE185D', '#4B5563', '#1E40AF', '#7C3AED',
];

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

interface ContextMenuState {
  x: number;
  y: number;
  type: 'annotation' | 'page';
  annotationId?: string;
  pageNum?: number;
  /** For 'page' type, the click position relative to the page div */
  pageX?: number;
  pageY?: number;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(14);
  const [markSize, setMarkSize] = useState(22);
  const [globalColor, setGlobalColor] = useState('#000000');
  const [showSigPad, setShowSigPad] = useState(false);
  const [sigData, setSigData] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [future, setFuture] = useState<Annotation[][]>([]);
  const [clipboard, setClipboard] = useState<Annotation | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

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
    setFuture([]);
  }, [annotations]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setAnnotations((curr) => {
        setFuture((f) => [...f.slice(-30), curr]);
        return prev;
      });
      return h.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[f.length - 1];
      setAnnotations((curr) => {
        setHistory((h) => [...h.slice(-30), curr]);
        return next;
      });
      return f.slice(0, -1);
    });
  }, []);

  const addAnnotation = useCallback(
    (partial: Omit<Annotation, 'id'>) => {
      pushHistory();
      const id = uid();
      setAnnotations((prev) => [...prev, { id, ...partial }]);
      setSelectedId(id);
      if (partial.type === 'text') setEditingId(id);
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
    setEditingId(null);
  }, [selectedId, pushHistory]);

  const deleteAnnotation = useCallback((id: string) => {
    pushHistory();
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setEditingId(null);
    }
  }, [pushHistory, selectedId]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId) return;
    const src = annotations.find((a) => a.id === selectedId);
    if (!src) return;
    pushHistory();
    const newId = uid();
    const dup = { ...src, id: newId, x: src.x + 20, y: src.y + 20 };
    setAnnotations((prev) => [...prev, dup]);
    setSelectedId(newId);
  }, [selectedId, annotations, pushHistory]);

  const duplicateAnnotation = useCallback((id: string) => {
    const src = annotations.find((a) => a.id === id);
    if (!src) return;
    pushHistory();
    const newId = uid();
    const dup = { ...src, id: newId, x: src.x + 20, y: src.y + 20 };
    setAnnotations((prev) => [...prev, dup]);
    setSelectedId(newId);
  }, [annotations, pushHistory]);

  const copySelected = useCallback(() => {
    if (!selectedId) return;
    const src = annotations.find((a) => a.id === selectedId);
    if (src) setClipboard(src);
  }, [selectedId, annotations]);

  const copyAnnotation = useCallback((id: string) => {
    const src = annotations.find((a) => a.id === id);
    if (src) setClipboard(src);
  }, [annotations]);

  const pasteClipboard = useCallback((atX?: number, atY?: number, atPage?: number) => {
    if (!clipboard) return;
    pushHistory();
    const newId = uid();
    const pasted = {
      ...clipboard,
      id: newId,
      x: atX ?? clipboard.x + 20,
      y: atY ?? clipboard.y + 20,
      page: atPage ?? clipboard.page,
    };
    setAnnotations((prev) => [...prev, pasted]);
    setSelectedId(newId);
  }, [clipboard, pushHistory]);

  const bringToFront = useCallback((id: string) => {
    pushHistory();
    setAnnotations((prev) => {
      const ann = prev.find((a) => a.id === id);
      if (!ann) return prev;
      return [...prev.filter((a) => a.id !== id), ann];
    });
  }, [pushHistory]);

  const sendToBack = useCallback((id: string) => {
    pushHistory();
    setAnnotations((prev) => {
      const ann = prev.find((a) => a.id === id);
      if (!ann) return prev;
      return [ann, ...prev.filter((a) => a.id !== id)];
    });
  }, [pushHistory]);

  /* ── Page click → place annotation ───────────────────────── */

  const handlePageClick = useCallback(
    (pageNum: number, e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-ann]')) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (tool === 'select') {
        setSelectedId(null);
        setEditingId(null);
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
          color: globalColor,
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
          color: globalColor,
        });
      } else if (tool === 'cross') {
        addAnnotation({
          type: 'cross',
          page: pageNum,
          x: x - markSize / 2,
          y: y - markSize / 2,
          width: markSize,
          height: markSize,
          color: globalColor,
        });
      } else if (tool === 'strikeout') {
        addAnnotation({
          type: 'strikeout',
          page: pageNum,
          x,
          y: y - 1,
          width: 150,
          height: 3,
          color: globalColor,
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
    [tool, fontSize, markSize, sigData, globalColor, addAnnotation],
  );

  /* ── Annotation mouse handlers ───────────────────────────── */

  const handleAnnotClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    setEditingId(null);
  };

  const handleAnnotDoubleClick = (e: React.MouseEvent, ann: Annotation) => {
    e.stopPropagation();
    if (ann.type === 'text') {
      setSelectedId(ann.id);
      setEditingId(ann.id);
    }
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
    setEditingId(null);
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

  /* ── Context menu handlers ──────────────────────────────── */

  const handleAnnotContextMenu = (e: React.MouseEvent, ann: Annotation) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(ann.id);
    setEditingId(null);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'annotation',
      annotationId: ann.id,
    });
  };

  const handlePageContextMenu = (pageNum: number, e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-ann]')) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'page',
      pageNum,
      pageX: e.clientX - rect.left,
      pageY: e.clientY - rect.top,
    });
  };

  /* ── Build context menu items ───────────────────────────── */

  const buildAnnotationMenuItems = (annId: string): ContextMenuItem[] => {
    const ann = annotations.find((a) => a.id === annId);
    if (!ann) return [];

    const isTextType = ann.type === 'text';
    const hasColor = ann.type !== 'signature';
    const annColor = ann.color || '#000000';

    const items: ContextMenuItem[] = [
      {
        label: 'Copy',
        icon: <Copy size={14} />,
        shortcut: 'Ctrl+C',
        onClick: () => copyAnnotation(annId),
      },
      {
        label: 'Duplicate',
        icon: <CopyPlus size={14} />,
        shortcut: 'D',
        onClick: () => duplicateAnnotation(annId),
      },
      { label: '', divider: true },
    ];

    if (hasColor) {
      items.push({
        label: 'Color',
        icon: <Palette size={14} />,
        submenu: (
          <div className="flex flex-wrap gap-1.5 py-1">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  pushHistory();
                  updateAnnotation(annId, { color: c });
                  setContextMenu(null);
                }}
                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-125 ${
                  annColor === c ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        ),
      });
    }

    if (isTextType) {
      items.push({
        label: 'Font Size',
        icon: <Type size={14} />,
        shortcut: '[ / ]',
        submenu: (
          <div className="flex items-center gap-2 py-1">
            <button
              onClick={() => {
                pushHistory();
                updateAnnotation(annId, { fontSize: Math.max(8, (ann.fontSize || 14) - 1) });
              }}
              className="p-1 hover:bg-white/10 rounded text-gray-300"
            >
              <Minus size={12} />
            </button>
            <span className="text-xs font-mono text-gray-300 w-5 text-center">
              {ann.fontSize || 14}
            </span>
            <button
              onClick={() => {
                pushHistory();
                updateAnnotation(annId, { fontSize: Math.min(48, (ann.fontSize || 14) + 1) });
              }}
              className="p-1 hover:bg-white/10 rounded text-gray-300"
            >
              <Plus size={12} />
            </button>
          </div>
        ),
      });
    }

    items.push(
      { label: '', divider: true },
      {
        label: 'Bring to Front',
        icon: <ArrowUpToLine size={14} />,
        onClick: () => bringToFront(annId),
      },
      {
        label: 'Send to Back',
        icon: <ArrowDownToLine size={14} />,
        onClick: () => sendToBack(annId),
      },
      { label: '', divider: true },
      {
        label: 'Delete',
        icon: <Trash2 size={14} />,
        shortcut: 'Del',
        danger: true,
        onClick: () => deleteAnnotation(annId),
      },
    );

    return items;
  };

  const buildPageMenuItems = (pageX: number, pageY: number, pageNum: number): ContextMenuItem[] => {
    return [
      {
        label: 'Paste',
        icon: <ClipboardPaste size={14} />,
        shortcut: 'Ctrl+V',
        disabled: !clipboard,
        onClick: () => pasteClipboard(pageX, pageY, pageNum),
      },
    ];
  };

  /* ── Download ────────────────────────────────────────────── */

  const handleDownload = useCallback(async () => {
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

      trackEvent('pdf_download', {
        pageCount: pages.length,
        annotationCount: annotations.length,
      });
    } catch (err) {
      console.error('Export failed:', err);
    }
    setSaving(false);
  }, [pdfBytes, annotations, pages, fileName]);

  const handleSaveProgress = useCallback(() => {
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
      savedAt: new Date().toISOString(),
      pageCount: pages.length,
      annotationCount: annotations.length,
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

    trackEvent('fillbuddy_save', {
      pageCount: pages.length,
      annotationCount: annotations.length,
    });

    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  }, [pdfBytes, fileName, annotations, pages.length]);

  /* ── Keyboard shortcuts ──────────────────────────────────── */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA';
      const mod = e.ctrlKey || e.metaKey;

      // Shortcuts that work even in inputs: Ctrl+S, Ctrl+D (download), Escape
      if (mod && e.key === 's') {
        e.preventDefault();
        handleSaveProgress();
        return;
      }
      if (e.key === 'Escape') {
        if (contextMenu) { setContextMenu(null); return; }
        if (editingId) { setEditingId(null); setTool('select'); return; }
        setSelectedId(null); setShowLegend(false); return;
      }

      // Block remaining shortcuts when typing in inputs
      if (inInput) return;

      // Modifier combos
      if (mod && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); return; }
      if (mod && e.key === 'z') { e.preventDefault(); undo(); return; }
      if (mod && e.key === 'c') { e.preventDefault(); copySelected(); return; }
      if (mod && e.key === 'v') { e.preventDefault(); pasteClipboard(); return; }
      if (mod && e.key === 'd') { e.preventDefault(); handleDownload(); return; }

      // Delete / Escape
      if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); return; }

      // Single-key tool switch
      if (e.key === 'v' || e.key === 'V') { setTool('select'); return; }
      if (e.key === 't' || e.key === 'T') { setTool('text'); return; }
      if (e.key === 'c' || e.key === 'C') { setTool('check'); return; }
      if (e.key === 'x' || e.key === 'X') { setTool('cross'); return; }
      if (e.key === 'l' || e.key === 'L') { setTool('strikeout'); return; }
      if (e.key === 's' || e.key === 'S') {
        if (!sigData) { setShowSigPad(true); } else { setTool('signature'); }
        return;
      }

      // Duplicate
      if (e.key === 'd' || e.key === 'D') { duplicateSelected(); return; }

      // Toggle legend
      if (e.key === '?') { setShowLegend((v) => !v); return; }

      // Size adjustment: [ and ]
      if (e.key === '[') {
        if (tool === 'text') setFontSize((s) => Math.max(8, s - 1));
        else if (tool === 'check' || tool === 'cross') setMarkSize((s) => Math.max(10, s - 2));
        if (selectedId) {
          const sel = annotations.find((a) => a.id === selectedId);
          if (sel?.type === 'text') updateAnnotation(sel.id, { fontSize: Math.max(8, (sel.fontSize || 14) - 1) });
          else if (sel && (sel.type === 'check' || sel.type === 'cross')) {
            updateAnnotation(sel.id, { width: Math.max(10, sel.width - 2), height: Math.max(10, sel.height - 2) });
          }
        }
        return;
      }
      if (e.key === ']') {
        if (tool === 'text') setFontSize((s) => Math.min(48, s + 1));
        else if (tool === 'check' || tool === 'cross') setMarkSize((s) => Math.min(60, s + 2));
        if (selectedId) {
          const sel = annotations.find((a) => a.id === selectedId);
          if (sel?.type === 'text') updateAnnotation(sel.id, { fontSize: Math.min(48, (sel.fontSize || 14) + 1) });
          else if (sel && (sel.type === 'check' || sel.type === 'cross')) {
            updateAnnotation(sel.id, { width: Math.min(60, sel.width + 2), height: Math.min(60, sel.height + 2) });
          }
        }
        return;
      }

      // Arrow nudge
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedId) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
        const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
        setAnnotations((prev) =>
          prev.map((a) => (a.id === selectedId ? { ...a, x: a.x + dx, y: a.y + dy } : a)),
        );
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelected, undo, redo, copySelected, pasteClipboard, duplicateSelected, handleSaveProgress, handleDownload, tool, sigData, selectedId, editingId, annotations, updateAnnotation, contextMenu]);

  /* ── Toolbar config ──────────────────────────────────────── */

  const toolShortcutMap: Record<ToolType, string> = {
    select: 'V', text: 'T', check: 'C', cross: 'X', strikeout: 'L', signature: 'S',
  };

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
                <Logo size={14} className="text-white" />
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
              title="Save progress (Ctrl+S)"
            >
              <Save size={16} /> Save
            </button>
            <button
              onClick={handleDownload}
              disabled={saving}
              className="flex items-center gap-1.5 bg-amber-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
              title="Download PDF (Ctrl+D)"
            >
              <Download size={16} /> {saving ? 'Saving...' : 'Download PDF'}
            </button>
          </div>
        </div>

        {/* ── Toolbar Row 1: Tools + Actions ── */}
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
                title={`${t.label} (${toolShortcutMap[t.id]})`}
              >
                {t.icon} {t.label}
                <kbd className="hidden sm:inline text-[10px] font-mono opacity-50 ml-0.5">{toolShortcutMap[t.id]}</kbd>
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

            {/* Redo */}
            <button
              onClick={redo}
              disabled={!future.length}
              className="p-1.5 hover:bg-gray-200 rounded text-gray-500 disabled:opacity-30"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 size={16} />
            </button>

            {/* Delete */}
            <button
              onClick={deleteSelected}
              disabled={!selectedId}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Delete (Del)"
            >
              <Trash2 size={14} /> Delete
            </button>

            {/* Shortcuts legend toggle */}
            <button
              onClick={() => setShowLegend((v) => !v)}
              className={`p-1.5 rounded transition-colors ${
                showLegend ? 'bg-amber-100 text-amber-700' : 'hover:bg-gray-200 text-gray-500'
              }`}
              title="Keyboard shortcuts (?)"
            >
              <Keyboard size={16} />
            </button>
          </div>
        </div>

        {/* ── Toolbar Row 2: Color + Size (always visible) ── */}
        {(() => {
          const sel = selectedId ? annotations.find((a) => a.id === selectedId) : null;
          const isEditingAnnotation = !!sel;
          // What type are we working with? Selected annotation type, or the current tool
          const activeType = sel?.type ?? (tool === 'text' ? 'text' : tool === 'check' ? 'check' : tool === 'cross' ? 'cross' : tool === 'strikeout' ? 'strikeout' : null);
          const showColor = activeType && activeType !== 'signature';
          const showFontSize = activeType === 'text';
          const showMarkSize = activeType === 'check' || activeType === 'cross';
          const showSize = showFontSize || showMarkSize;

          // Current effective values
          const currentColor = sel ? (sel.color || '#000000') : globalColor;
          const currentFontSize = sel ? (sel.fontSize || 14) : fontSize;
          const currentMarkSize = sel ? Math.round(sel.width) : markSize;

          // Color change handler
          const handleColorChange = (c: string) => {
            if (isEditingAnnotation && sel) {
              pushHistory();
              updateAnnotation(sel.id, { color: c });
            }
            setGlobalColor(c);
          };

          // Size change handlers
          const handleFontSizeChange = (delta: number) => {
            const newSize = Math.max(8, Math.min(48, currentFontSize + delta));
            if (isEditingAnnotation && sel) {
              pushHistory();
              updateAnnotation(sel.id, { fontSize: newSize });
            }
            setFontSize(newSize);
          };

          const handleMarkSizeChange = (delta: number) => {
            if (isEditingAnnotation && sel) {
              pushHistory();
              updateAnnotation(sel.id, {
                width: Math.max(10, Math.min(60, sel.width + delta)),
                height: Math.max(10, Math.min(60, sel.height + delta)),
              });
            }
            setMarkSize((s) => Math.max(10, Math.min(60, s + delta)));
          };

          // Highlight style when editing a selected annotation
          const accent = isEditingAnnotation ? 'text-blue-600' : 'text-gray-500';
          const accentBtn = isEditingAnnotation ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-gray-200 text-gray-500';

          return (
            <div className="border-t bg-gray-50/80 px-4 py-1.5">
              <div className="flex items-center gap-1.5 max-w-5xl mx-auto flex-wrap">
                {/* Color swatches */}
                {showColor ? (
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs ${accent} font-medium`}>Color:</span>
                    <div className="flex gap-1">
                      {COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          onClick={() => handleColorChange(c)}
                          className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-125 ${
                            currentColor === c
                              ? (isEditingAnnotation ? 'border-blue-500 scale-110' : 'border-amber-500 scale-110')
                              : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 opacity-30">
                    <span className="text-xs text-gray-500 font-medium">Color:</span>
                    <div className="flex gap-1">
                      {COLOR_PRESETS.slice(0, 6).map((c) => (
                        <div
                          key={c}
                          className="w-5 h-5 rounded-full border-2 border-gray-200"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="w-px h-5 bg-gray-300 mx-2" />

                {/* Size control */}
                {showSize ? (
                  <div className="flex items-center gap-1">
                    <span className={`text-xs ${accent} font-medium`}>Size:</span>
                    <button
                      onClick={() => showFontSize ? handleFontSizeChange(-1) : handleMarkSizeChange(-2)}
                      className={`p-1 rounded ${accentBtn}`}
                    >
                      <Minus size={14} />
                    </button>
                    <span className={`text-sm font-mono w-6 text-center ${accent}`}>
                      {showFontSize ? currentFontSize : currentMarkSize}
                    </span>
                    <button
                      onClick={() => showFontSize ? handleFontSizeChange(1) : handleMarkSizeChange(2)}
                      className={`p-1 rounded ${accentBtn}`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 opacity-30">
                    <span className="text-xs text-gray-500 font-medium">Size:</span>
                    <div className="p-1 text-gray-400"><Minus size={14} /></div>
                    <span className="text-sm font-mono w-6 text-center text-gray-400">—</span>
                    <div className="p-1 text-gray-400"><Plus size={14} /></div>
                  </div>
                )}

                <div className="flex-1" />

                {/* Editing-mode indicator */}
                {isEditingAnnotation && sel && (
                  <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wider">
                    Editing {sel.type}
                  </span>
                )}
              </div>
            </div>
          );
        })()}
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
                onContextMenu={(e) => handlePageContextMenu(pg.pageNum, e)}
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
                      const annColor = ann.color || '#000000';

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
                          onDoubleClick={(e) => handleAnnotDoubleClick(e, ann)}
                          onContextMenu={(e) => handleAnnotContextMenu(e, ann)}
                          onMouseDown={(e) => {
                            if (e.button === 2) return; // don't start drag on right-click
                            if (ann.type !== 'text' || !isSelected || editingId !== ann.id) {
                              startMove(e, ann);
                            }
                          }}
                        >
                          {/* ── Text ── */}
                          {ann.type === 'text' &&
                            (editingId === ann.id ? (
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
                                  fontFamily: 'Helvetica, Arial, sans-serif',
                                  color: annColor,
                                }}
                                className="w-full bg-transparent outline-none resize-none"
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
                                  fontFamily: 'Helvetica, Arial, sans-serif',
                                  color: annColor,
                                }}
                                className="whitespace-pre-wrap break-words"
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
                              stroke={annColor}
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
                              stroke={annColor}
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
                            <div
                              className="w-full h-full"
                              style={{ backgroundColor: annColor }}
                            />
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

      {/* ── Context Menu ── */}
      {contextMenu && contextMenu.type === 'annotation' && contextMenu.annotationId && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildAnnotationMenuItems(contextMenu.annotationId)}
          onClose={() => setContextMenu(null)}
        />
      )}
      {contextMenu && contextMenu.type === 'page' && contextMenu.pageNum != null && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildPageMenuItems(contextMenu.pageX!, contextMenu.pageY!, contextMenu.pageNum)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* ── Shortcut Legend Panel ── */}
      {showLegend && (
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex justify-center pb-6">
          <div className="pointer-events-auto bg-gray-900/95 backdrop-blur text-white rounded-2xl shadow-2xl px-6 py-5 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-amber-400">Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowLegend(false)}
                className="text-gray-400 hover:text-white text-xs"
              >
                ESC to close
              </button>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-1 text-xs">
              {/* Tools */}
              <div>
                <p className="text-gray-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">Tools</p>
                {[['V', 'Select'], ['T', 'Text'], ['C', 'Check mark'], ['X', 'Cross mark'], ['L', 'Strikeout'], ['S', 'Signature']].map(([key, label]) => (
                  <div key={key} className="flex justify-between py-0.5">
                    <span className="text-gray-300">{label}</span>
                    <kbd className="bg-gray-700 px-1.5 py-0.5 rounded font-mono text-[10px]">{key}</kbd>
                  </div>
                ))}
              </div>
              {/* Actions */}
              <div>
                <p className="text-gray-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">Actions</p>
                {[
                  ['Ctrl+Z', 'Undo'],
                  ['Ctrl+Shift+Z', 'Redo'],
                  ['Ctrl+C', 'Copy'],
                  ['Ctrl+V', 'Paste'],
                  ['Ctrl+S', 'Save'],
                  ['Ctrl+D', 'Download'],
                ].map(([key, label]) => (
                  <div key={key} className="flex justify-between py-0.5">
                    <span className="text-gray-300">{label}</span>
                    <kbd className="bg-gray-700 px-1.5 py-0.5 rounded font-mono text-[10px]">{key}</kbd>
                  </div>
                ))}
              </div>
              {/* Editing */}
              <div>
                <p className="text-gray-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">Editing</p>
                {[
                  ['D', 'Duplicate'],
                  ['Del', 'Delete'],
                  ['Esc', 'Deselect'],
                  ['[ / ]', 'Resize'],
                  ['Arrows', 'Nudge 1px'],
                  ['Shift+Arrows', 'Nudge 10px'],
                ].map(([key, label]) => (
                  <div key={key} className="flex justify-between py-0.5">
                    <span className="text-gray-300">{label}</span>
                    <kbd className="bg-gray-700 px-1.5 py-0.5 rounded font-mono text-[10px]">{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-3 text-center">On Mac, use ⌘ instead of Ctrl</p>
          </div>
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

      {/* ── Save toast ── */}
      {saveToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-up">
          <div className="flex items-center gap-3 bg-gray-900/95 backdrop-blur text-white pl-4 pr-5 py-3 rounded-2xl shadow-2xl">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <Check size={16} strokeWidth={3} />
            </div>
            <div>
              <p className="text-sm font-semibold">Progress saved!</p>
              <p className="text-xs text-gray-400">
                {fileName.replace(/\.pdf$/i, '')}.fillbuddy &middot; {annotations.length} annotation{annotations.length !== 1 ? 's' : ''} &middot; {pages.length} page{pages.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
