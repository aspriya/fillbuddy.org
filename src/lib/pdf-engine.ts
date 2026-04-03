import type { FormField, EngineMode, Annotation, PageData } from './types';
import { getRadioLabel } from './field-helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

let pdfLib: typeof import('pdf-lib') | null = null;
let pdfjsLib: any = null;

export async function loadEngines(): Promise<void> {
  if (pdfLib && pdfjsLib) return;

  const [pdfLibModule, pdfjsModule] = await Promise.all([
    import('pdf-lib'),
    import('pdfjs-dist'),
  ]);

  pdfLib = pdfLibModule;
  pdfjsLib = pdfjsModule;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/* ── Strategy 1: pdf-lib (unencrypted PDFs) ──────────────── */
async function extractWithPdfLib(bytes: ArrayBuffer): Promise<FormField[] | null> {
  if (!pdfLib) throw new Error('Engines not loaded');

  // Suppress pdf-lib parser warnings for PDFs with non-standard objects
  const origWarn = console.warn;
  console.warn = () => {};
  let doc;
  try {
    doc = await pdfLib.PDFDocument.load(bytes, { ignoreEncryption: true });
  } finally {
    console.warn = origWarn;
  }

  const form = doc.getForm();
  const raw = form.getFields();
  if (!raw.length) return null;

  return raw.map((f) => {
    const name = f.getName();
    const type = f.constructor.name;

    if (type === 'PDFCheckBox')
      return { name, type: 'checkbox' as const, pdfLib: true };

    if (type === 'PDFRadioGroup') {
      let options: string[] = [];
      try { options = (f as any).getOptions(); } catch { /* empty */ }
      return {
        name,
        type: 'radio' as const,
        pdfLib: true,
        options: options.map((v) => ({ value: v, label: getRadioLabel(name, v) })),
      };
    }

    if (type === 'PDFDropdown' || type === 'PDFOptionList') {
      let options: string[] = [];
      try { options = (f as any).getOptions(); } catch { /* empty */ }
      return { name, type: 'dropdown' as const, pdfLib: true, options: options.map((v) => ({ value: v, label: v })) };
    }

    let value = '';
    try { value = (f as any).getText() || ''; } catch { /* empty */ }
    return { name, type: 'text' as const, pdfLib: true, value };
  });
}

/* ── Strategy 2: pdf.js (handles encrypted PDFs) ─────────── */
async function extractWithPdfJs(bytes: ArrayBuffer): Promise<FormField[]> {
  if (!pdfjsLib) throw new Error('Engines not loaded');

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
  const radioGroups: Record<string, FormField> = {};
  const allFields: FormField[] = [];
  const seen = new Set<string>();

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const annotations = await page.getAnnotations();

    for (const ann of annotations) {
      if (!ann.fieldType) continue;

      if (ann.fieldType === 'Btn' && ann.radioButton) {
        if (!radioGroups[ann.fieldName])
          radioGroups[ann.fieldName] = { name: ann.fieldName, type: 'radio', options: [] };
        radioGroups[ann.fieldName].options!.push({
          value: String(ann.buttonValue),
          label: getRadioLabel(ann.fieldName, ann.buttonValue),
          rect: ann.rect,
          page: i,
        });
      } else if (ann.fieldType === 'Btn' && ann.checkBox) {
        if (!seen.has(ann.fieldName)) {
          seen.add(ann.fieldName);
          allFields.push({ name: ann.fieldName, type: 'checkbox', rect: ann.rect, page: i });
        }
      } else if (ann.fieldType === 'Tx') {
        if (!seen.has(ann.fieldName)) {
          seen.add(ann.fieldName);
          allFields.push({ name: ann.fieldName, type: 'text', rect: ann.rect, page: i, value: ann.fieldValue || '' });
        }
      }
    }
  }

  // Build ordered list preserving page order
  const ordered: FormField[] = [];
  const done = new Set<string>();

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const annotations = await page.getAnnotations();
    for (const ann of annotations) {
      if (!ann.fieldType || done.has(ann.fieldName)) continue;
      done.add(ann.fieldName);
      if (radioGroups[ann.fieldName]) ordered.push(radioGroups[ann.fieldName]);
      else {
        const field = allFields.find((f) => f.name === ann.fieldName);
        if (field) ordered.push(field);
      }
    }
  }

  return ordered;
}

/* ── Main extraction with dual-engine fallback ───────────── */
export async function extractFields(
  bytes: ArrayBuffer,
): Promise<{ fields: FormField[]; mode: EngineMode }> {
  let result: FormField[] | null = null;
  let mode: EngineMode = 'direct';

  try {
    result = await extractWithPdfLib(bytes);
  } catch {
    // pdf-lib fails on encrypted PDFs — fall through
  }

  if (!result || result.length === 0) {
    mode = 'overlay';
    result = await extractWithPdfJs(bytes);
  }

  if (!result || result.length === 0) {
    throw new Error('No fillable form fields found in this PDF.');
  }

  return { fields: result, mode };
}

/* ── Download: Direct fill mode ──────────────────────────── */
export async function downloadDirect(
  pdfBytes: Uint8Array,
  values: Record<string, any>,
): Promise<Uint8Array> {
  if (!pdfLib) throw new Error('Engines not loaded');

  const origWarn = console.warn;
  console.warn = () => {};
  let doc;
  try {
    doc = await pdfLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  } finally {
    console.warn = origWarn;
  }
  const form = doc.getForm();

  Object.entries(values).forEach(([name, value]) => {
    try {
      const field = form.getField(name);
      const type = field.constructor.name;

      if (type === 'PDFTextField') (field as any).setText(value || '');
      else if (type === 'PDFCheckBox') {
        if (value) (field as any).check();
        else (field as any).uncheck();
      } else if (type === 'PDFRadioGroup' && value) (field as any).select(value);
      else if ((type === 'PDFDropdown' || type === 'PDFOptionList') && value)
        (field as any).select(value);
    } catch {
      // skip fields that can't be filled
    }
  });

  form.flatten();
  return await doc.save();
}

/* ── Download: Overlay mode (for encrypted PDFs) ─────────── */
export async function downloadOverlay(
  pdfBytes: Uint8Array,
  fields: FormField[],
  values: Record<string, any>,
): Promise<Uint8Array> {
  if (!pdfLib || !pdfjsLib) throw new Error('Engines not loaded');

  const { PDFDocument, StandardFonts, rgb } = pdfLib;
  const src = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  const newDoc = await PDFDocument.create();
  const font = await newDoc.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= src.numPages; i++) {
    const srcPage = await src.getPage(i);
    const viewport = srcPage.getViewport({ scale: 1 });
    const W = viewport.width;
    const H = viewport.height;
    const scale = 3;

    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    await srcPage.render({
      canvasContext: canvas.getContext('2d')!,
      viewport: srcPage.getViewport({ scale }),
    }).promise;

    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
    const imageBytes = new Uint8Array(await blob.arrayBuffer());
    const image = await newDoc.embedPng(imageBytes);
    const page = newDoc.addPage([W, H]);
    page.drawImage(image, { x: 0, y: 0, width: W, height: H });

    const pageFields = fields.filter(
      (f) => f.page === i || (f.options && f.options.some((o) => o.page === i)),
    );

    pageFields.forEach((f) => {
      const v = values[f.name];
      if (v === '' || v === false || v == null) return;

      if (f.type === 'text' && f.rect) {
        const [x1, y1, , y2] = f.rect;
        const fh = y2 - y1;
        const fs = Math.min(fh * 0.72, 10);
        page.drawText(String(v), { x: x1 + 2, y: y1 + fh * 0.25, size: fs, font, color: rgb(0, 0, 0) });
      } else if (f.type === 'radio' && f.options) {
        const opt = f.options.find((o) => o.value === v && o.page === i);
        if (opt?.rect) {
          const [x1, y1, x2, y2] = opt.rect;
          page.drawCircle({ x: (x1 + x2) / 2, y: (y1 + y2) / 2, size: Math.min(x2 - x1, y2 - y1) * 0.28, color: rgb(0, 0, 0) });
        }
      } else if (f.type === 'checkbox' && v && f.rect) {
        const [x1, y1, x2, y2] = f.rect;
        const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, s = (x2 - x1) * 0.3;
        page.drawLine({ start: { x: cx - s, y: cy }, end: { x: cx - s * 0.2, y: cy - s * 0.8 }, thickness: 1.5, color: rgb(0, 0, 0) });
        page.drawLine({ start: { x: cx - s * 0.2, y: cy - s * 0.8 }, end: { x: cx + s, y: cy + s * 0.7 }, thickness: 1.5, color: rgb(0, 0, 0) });
      }
    });
  }

  return await newDoc.save();
}

/* ── Export: Bake annotations onto PDF ────────────────────── */

async function drawAnnotationsOnPage(
  page: any,
  doc: any,
  anns: Annotation[],
  pd: PageData,
  pgH: number,
  font: any,
  rgbFn: any,
) {
  const sc = pd.scale;
  for (const ann of anns) {
    const pdfX = ann.x / sc;
    const pdfW = ann.width / sc;
    const pdfH = ann.height / sc;
    const topPdfY = pgH - ann.y / sc;

    if (ann.type === 'text' && ann.content) {
      const pdfFS = (ann.fontSize || 14) / sc;
      const lines = ann.content.split('\n');
      const lh = pdfFS * 1.3;
      lines.forEach((line: string, i: number) => {
        if (!line) return;
        page.drawText(line, {
          x: pdfX,
          y: topPdfY - pdfFS - i * lh,
          size: pdfFS,
          font,
          color: rgbFn(0, 0, 0),
        });
      });
    } else if (ann.type === 'check') {
      const cx = pdfX + pdfW / 2;
      const cy = topPdfY - pdfH / 2;
      const s = Math.min(pdfW, pdfH) * 0.4;
      const th = Math.max(1, pdfW / 12);
      page.drawLine({ start: { x: cx - s, y: cy }, end: { x: cx - s * 0.2, y: cy - s * 0.7 }, thickness: th, color: rgbFn(0, 0, 0) });
      page.drawLine({ start: { x: cx - s * 0.2, y: cy - s * 0.7 }, end: { x: cx + s, y: cy + s * 0.5 }, thickness: th, color: rgbFn(0, 0, 0) });
    } else if (ann.type === 'cross') {
      const cx = pdfX + pdfW / 2;
      const cy = topPdfY - pdfH / 2;
      const s = Math.min(pdfW, pdfH) * 0.35;
      const th = Math.max(1, pdfW / 12);
      page.drawLine({ start: { x: cx - s, y: cy - s }, end: { x: cx + s, y: cy + s }, thickness: th, color: rgbFn(0, 0, 0) });
      page.drawLine({ start: { x: cx - s, y: cy + s }, end: { x: cx + s, y: cy - s }, thickness: th, color: rgbFn(0, 0, 0) });
    } else if (ann.type === 'strikeout') {
      const lineY = topPdfY - pdfH / 2;
      page.drawLine({
        start: { x: pdfX, y: lineY },
        end: { x: pdfX + pdfW, y: lineY },
        thickness: Math.max(0.5, pdfH),
        color: rgbFn(0, 0, 0),
      });
    } else if (ann.type === 'signature' && ann.imageData) {
      const res = await fetch(ann.imageData);
      const imgBytes = new Uint8Array(await res.arrayBuffer());
      const img = await doc.embedPng(imgBytes);
      page.drawImage(img, {
        x: pdfX,
        y: topPdfY - pdfH,
        width: pdfW,
        height: pdfH,
      });
    }
  }
}

export async function exportAnnotatedPdf(
  pdfBytes: Uint8Array,
  annotations: Annotation[],
  pageData: PageData[],
): Promise<Uint8Array> {
  if (!pdfLib || !pdfjsLib) throw new Error('Engines not loaded');

  const { PDFDocument, StandardFonts, rgb } = pdfLib;

  // Strategy 1: modify original PDF in-place (preserves vectors & text)
  try {
    const origWarn = console.warn;
    console.warn = () => {};
    let doc;
    try {
      doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    } finally {
      console.warn = origWarn;
    }

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pdfPages = doc.getPages();

    for (const pd of pageData) {
      const page = pdfPages[pd.pageNum - 1];
      if (!page) continue;
      const { height: pgH } = page.getSize();
      const anns = annotations.filter((a) => a.page === pd.pageNum);
      await drawAnnotationsOnPage(page, doc, anns, pd, pgH, font, rgb);
    }

    return await doc.save();
  } catch {
    // Strategy 2: render pages via pdfjs, create fresh PDF
    const srcDoc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
    const newDoc = await PDFDocument.create();
    const font = await newDoc.embedFont(StandardFonts.Helvetica);

    for (let i = 1; i <= srcDoc.numPages; i++) {
      const srcPage = await srcDoc.getPage(i);
      const vp = srcPage.getViewport({ scale: 1 });
      const renderScale = 3;

      const canvas = document.createElement('canvas');
      canvas.width = vp.width * renderScale;
      canvas.height = vp.height * renderScale;
      await srcPage.render({
        canvasContext: canvas.getContext('2d')!,
        viewport: srcPage.getViewport({ scale: renderScale }),
      }).promise;

      const blob = await new Promise<Blob>((r) =>
        canvas.toBlob((b) => r(b!), 'image/jpeg', 0.92),
      );
      const imageBytes = new Uint8Array(await blob.arrayBuffer());
      const image = await newDoc.embedJpg(imageBytes);
      const page = newDoc.addPage([vp.width, vp.height]);
      page.drawImage(image, { x: 0, y: 0, width: vp.width, height: vp.height });

      const pd = pageData.find((p) => p.pageNum === i);
      if (pd) {
        const anns = annotations.filter((a) => a.page === i);
        await drawAnnotationsOnPage(page, newDoc, anns, pd, vp.height, font, rgb);
      }
    }

    return await newDoc.save();
  }
}
