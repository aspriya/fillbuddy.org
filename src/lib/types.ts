export interface FormField {
  name: string;
  type: 'text' | 'radio' | 'checkbox' | 'dropdown';
  page?: number;
  rect?: [number, number, number, number];
  value?: string;
  options?: RadioOption[];
  pdfLib?: boolean;
}

export interface RadioOption {
  value: string;
  label: string;
  rect?: [number, number, number, number];
  page?: number;
}

export type EngineMode = 'direct' | 'overlay';

/* ── Annotation overlay types ─────────────────────────────── */

export type ToolType = 'select' | 'text' | 'check' | 'cross' | 'strikeout' | 'signature';

export interface Annotation {
  id: string;
  type: 'text' | 'check' | 'cross' | 'strikeout' | 'signature';
  page: number;
  x: number;       // display px from left
  y: number;       // display px from top
  width: number;   // display px
  height: number;  // display px
  content?: string;
  fontSize?: number;
  imageData?: string;
}

export interface PageData {
  pageNum: number;
  dataUrl: string;
  displayWidth: number;
  displayHeight: number;
  pdfWidth: number;
  pdfHeight: number;
  scale: number;
}
