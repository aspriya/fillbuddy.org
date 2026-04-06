# FillBuddy — Project Description

> **Last updated:** 2026-04-06
> **Domain:** [fillbuddy.org](https://fillbuddy.org)
> **Status:** Active development — migrated from single-file prototype to Next.js app

---

## What Is FillBuddy?

FillBuddy is a **100% client-side PDF annotation and form-filling web application**. Users upload any PDF (including encrypted ones), annotate it directly in the browser using text, check marks, cross marks, strikeout lines, and signatures, then download the completed PDF — **all without any data ever leaving the browser**.

The core value proposition: **privacy-first PDF filling with save-and-resume capability**. Unlike every competitor (Adobe, Smallpdf, iLovePDF), FillBuddy never uploads files to a server, never requires an account, and never adds watermarks. Its `.fillbuddy` save format preserves full editability of annotations — solving the widespread "tattoo problem" where other tools permanently bake edits into the PDF.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | **Next.js 16** (App Router) | TypeScript, `src/` directory |
| React | **React 19** | |
| Styling | **Tailwind CSS 4** | PostCSS plugin via `@tailwindcss/postcss` |
| PDF Parsing | **pdfjs-dist 3.11.x** | Handles encrypted PDFs, renders pages to canvas, extracts annotations |
| PDF Generation | **pdf-lib 1.17.x** | Creates/modifies PDFs, embeds text/images, flattens forms |
| Icons | **lucide-react** | |
| Fonts | **Inter** (headings) + **Manrope** (body) | Loaded via `next/font/google` |

---

## Architecture Overview

### Dual-Engine PDF Processing

The core technical innovation is a **hybrid pdf-lib + pdfjs-dist engine** (`src/lib/pdf-engine.ts`) that uses a two-strategy fallback:

```
User uploads PDF
       │
       ▼
┌─ Strategy 1: pdf-lib (direct) ─────────────────┐
│  PDFDocument.load() → getForm().getFields()      │
│  If fields found → mode = "direct"               │
│  (fails on encrypted PDFs)                       │
└──────────────────────────────────────────────────┘
       │ (falls through on failure)
       ▼
┌─ Strategy 2: pdfjs-dist (overlay) ──────────────┐
│  getDocument() handles decryption automatically   │
│  page.getAnnotations() extracts form field data   │
│  Stores field rects + page numbers                │
│  mode = "overlay"                                │
└──────────────────────────────────────────────────┘
```

### Export Strategies

The same dual-strategy approach applies at download time:

| Mode | How It Works | Output |
|------|-------------|--------|
| **Direct** (Strategy 1) | pdf-lib modifies the original PDF in-place, fills native form fields, then flattens | Perfect vector output, small file |
| **Overlay** (Strategy 2) | pdfjs-dist renders each page to canvas at 3× scale, pdf-lib creates a new PDF with page images + vector annotations drawn at exact coordinates | Raster background at ~216 DPI, but annotation text/marks are crisp vector |

### The Annotation Approach (Current Primary UX)

The app has **evolved beyond form-field filling** into a general-purpose **PDF annotation tool**. Instead of detecting and mapping form fields to a web form, the current primary workflow renders the PDF visually and lets users **click anywhere to place annotations**.

Annotation types supported:
- **Text** — Click to place, type content, adjustable font size, movable/resizable
- **Check marks (✓)** — Adjustable size
- **Cross marks (✗)** — Adjustable size
- **Strikeout lines** — Horizontal lines for redlining
- **Signatures** — Draw on canvas or upload image, automatic white background removal

All annotations are movable, resizable, and deletable. Full undo/redo history is supported.

#### Select vs Edit Mode

Text annotations have a **two-stage interaction model**:
- **Single click** → select mode (blue ring, drag/resize handles visible, can copy/delete/move/nudge)
- **Double click** → edit mode (textarea appears for typing)
- **Escape** while editing → back to select mode (annotation stays selected, tool switches to Select)
- **Escape** while selected → deselects entirely

Non-text annotations (checks, crosses, strikeout, signatures) go directly to select mode on click.

New text annotations placed via the text tool auto-enter edit mode so the user can start typing immediately.

#### Keyboard Shortcuts

A comprehensive keyboard shortcut system covers three categories:

| Category | Shortcut | Action |
|----------|----------|--------|
| **Tools** | `V` / `T` / `C` / `X` / `L` / `S` | Select / Text / Check / Cross / Strikeout / Signature |
| **Actions** | `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / Redo |
| | `Ctrl+C` / `Ctrl+V` | Copy / Paste annotation |
| | `Ctrl+S` / `Ctrl+D` | Save progress / Download PDF |
| **Editing** | `D` | Duplicate selected annotation |
| | `Delete` / `Backspace` | Delete selected |
| | `Escape` | Exit edit mode → deselect |
| | `[` / `]` | Decrease / increase font or mark size |
| | Arrow keys | Nudge 1px (Shift+Arrow = 10px) |
| | `?` | Toggle shortcut legend panel |

Mac users use `Cmd` instead of `Ctrl`. Shortcuts that conflict with typing (single keys) are disabled when a textarea is focused, but `Ctrl+S` and `Escape` work even during text editing.

A **shortcut legend panel** (toggled via toolbar ⌨ button or `?` key) displays all shortcuts in a floating dark overlay at the bottom of the screen, categorized into Tools / Actions / Editing columns.

---

## Application Flow

```
Landing Page (/)  →  Upload Page (/app)  →  PDF Annotator (/app)
     SSR               Client Component       Client Component
```

### Landing Page (`src/app/page.tsx`)
- **Server-rendered** for SEO
- Dark theme with animated gradient background
- Hero section, trust bar, how-it-works steps, feature grid, pain-point comparisons, competitor table, FAQ
- JSON-LD structured data (`SoftwareApplication` + `FAQPage` schemas)
- Links to `/app` to start

### App Page (`src/app/app/page.tsx`)
- **Client component** (`'use client'`)
- Manages the upload → annotate flow
- Loads PDF engines on mount via `loadEngines()`
- Handles both `.pdf` and `.fillbuddy` file uploads
- **Branded resume card** — when loading a `.fillbuddy` file, shows a 2-second branded card with amber gradient header, FillBuddy logo, `.fillbuddy` badge, file name, page count, annotation count, save date, and animated progress bar before transitioning to the editor
- Passes PDF bytes + initial annotations to `PdfAnnotator`

### Upload Zone (`src/components/UploadZone.tsx`)
- Drag-and-drop or file picker
- Accepts `.pdf` and `.fillbuddy` files
- Shows loading spinner during PDF analysis

### PDF Annotator (`src/components/PdfAnnotator.tsx`)
- **The main workspace** — renders all PDF pages as images, overlays interactive annotation layer
- Sticky toolbar with tool selection (Select, Text, Tick, Cross, Strike, Sign) — each button shows its keyboard shortcut
- Font size / mark size controls (toolbar + `[`/`]` keys)
- Per-annotation two-stage interaction: single click = select (move/resize/copy/delete), double click = edit (type text)
- Undo/redo with full history stacks
- Copy/paste/duplicate annotations with clipboard state
- Arrow key nudging (1px, Shift = 10px)
- Comprehensive keyboard shortcuts (see Architecture section above)
- Shortcut legend panel — floating dark overlay toggled via toolbar button or `?` key
- **Save Progress** — exports a `.fillbuddy` JSON file containing the PDF (base64) + all annotations + metadata (save time, page/annotation counts). Shows a **branded success toast** with file details that auto-dismisses after 3 seconds.
- **Download PDF** — calls `exportAnnotatedPdf()` which bakes annotations into a real PDF

### Signature Pad (`src/components/SignaturePad.tsx`)
- Modal with canvas for drawing signatures
- Supports draw mode and image upload mode
- Adjustable stroke width
- Automatic white background removal (pixel-level alpha threshold)

---

## File Structure

```
fillbuddy.org/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout: font loading (Inter + Manrope), metadata, OG tags
│   │   ├── page.tsx            # Landing page (server component, SEO-optimized)
│   │   ├── globals.css         # Tailwind imports + custom animations + scrollbar styles
│   │   └── app/
│   │       └── page.tsx        # Main app page (client component: upload → annotate)
│   │
│   ├── components/
│   │   ├── PdfAnnotator.tsx    # Core annotation workspace (toolbar, page rendering, annotation CRUD)
│   │   ├── UploadZone.tsx      # Drag-and-drop PDF / .fillbuddy upload
│   │   └── SignaturePad.tsx    # Draw/upload signature with background removal
│   │
│   ├── lib/
│   │   ├── pdf-engine.ts       # Dual-engine core: loadEngines(), extractFields(), downloadDirect(),
│   │   │                       #   downloadOverlay(), exportAnnotatedPdf()
│   │   ├── field-helpers.ts    # Field name cleaning, radio labels, section grouping matchers
│   │   ├── types.ts            # TypeScript interfaces: FormField, RadioOption, EngineMode,
│   │   │                       #   ToolType, Annotation, PageData
│   │   └── canvas-shim.js      # Empty module to stub Node.js 'canvas' require from pdfjs-dist
│   │
├── public/
│   ├── fillbuddy-icon.svg      # App icon: amber gradient with document + pen + branding
│   └── fillbuddy-file-icon.svg # File-type icon: document shape with .fillbuddy badge,
│                                #   text lines, checkmark, and signature squiggle
│                                #   (ready for PWA file_handlers integration)
│
├── docs/
│   ├── PROJECT.md              # ← This file
│   └── competitive-analysis.md # Competitor research, Reddit pain points, SEO strategy
│
├── next.config.ts              # canvas alias for pdfjs-dist compatibility
├── package.json                # Dependencies and scripts
├── tsconfig.json
├── eslint.config.mjs
└── postcss.config.mjs
```

---

## Key Design Decisions

### 1. Client-Side Only — No Backend
All PDF processing happens in the browser. There is no API, no server-side processing, no database. This is the core privacy differentiator.

### 2. Annotation-First (Not Form-Field-First)
The original prototype (`fillbuddy.jsx`) detected PDF form fields and rendered them as a web form. The current Next.js app **pivoted to an annotation-based approach** — rendering the PDF visually and letting users click-to-place text/marks anywhere. This works on **any** PDF, not just fillable ones.

The legacy form-field components (`FormFiller.tsx`, `FieldRenderer.tsx`) are still in the codebase but are **not used** in the current app flow.

### 3. `.fillbuddy` Save Format
A JSON file containing:
```json
{
  "version": 1,
  "fileName": "form.pdf",
  "pdfBase64": "<base64-encoded PDF>",
  "annotations": [{ "id": "...", "type": "text", "page": 1, "x": 100, "y": 200, ... }],
  "savedAt": "2026-04-06T10:30:00.000Z",
  "pageCount": 3,
  "annotationCount": 12
}
```
This solves the "tattoo problem" — annotations remain fully editable after saving and reopening.

The `savedAt`, `pageCount`, and `annotationCount` metadata are used by the **branded resume card** shown when reopening a `.fillbuddy` file.

### 4. Canvas Shim for pdfjs-dist
pdfjs-dist has a `require('canvas')` for Node.js environments. The build aliases this to an empty shim (`canvas-shim.js`) via both webpack and turbopack config in `next.config.ts`.

### 5. PDF Export with Dual Fallback
`exportAnnotatedPdf()` first tries to modify the original PDF in-place (preserving vectors/text). If that fails (e.g., encrypted PDF), it falls back to rendering pages at 3× via pdfjs-dist canvas, then compositing annotations as vector drawings in a new pdf-lib document.

---

## .fillbuddy Save/Resume Format

The save format is the project's primary competitive moat. No other free tool allows users to:
1. Partially fill a PDF
2. Save to a local file
3. Reopen and continue editing with all annotations still movable/editable

The `.fillbuddy` file is a standard JSON blob that the app detects by file extension during upload.

---

## Legacy Code Notes

The original single-file prototype (`fillbuddy.jsx`) and legacy form-field components (`FormFiller.tsx`, `FieldRenderer.tsx`) have been removed. The form-field approach detected PDF fields and rendered them as a web form — this was replaced by the annotation-based approach.

- **`field-helpers.ts`** still exists and contains `cleanFieldName()`, `getRadioLabel()`, and `getSection()` helpers designed for bank credit card application forms (specific field name mappings like `Group2` → "Title"). These are not currently used but may be reactivated if the app adds a "smart form mode".

---

## Build & Run

```bash
npm install
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

## SEO & Metadata

- Root layout sets comprehensive `<title>`, `description`, `keywords`, OpenGraph, and Twitter Card metadata
- Landing page includes JSON-LD for `SoftwareApplication` and `FAQPage` schemas
- Canonical URL: `https://fillbuddy.org`
- Server-rendered landing page for crawlability
- FAQ section for long-tail keyword targeting

---

## Planned/Future Features

### Immediate (Next Release)
- **Text color changing** — Per-annotation and global-level color picker for text annotations. The global default color applies to new annotations; individual annotations can override via the toolbar or context menu.
- **Annotation right-click context menu** — Right-clicking an annotation shows a context menu with options: Copy, Delete, Duplicate, Change Color, Change Font Size, and Bring to Front/Send to Back.
- **Empty area right-click context menu** — Right-clicking on an empty area of the PDF page shows a context menu with Paste (enabled only when clipboard has a copied annotation).
- **PWA with File Handling API** — Register FillBuddy as a PWA file handler for `.fillbuddy` files so the OS shows a branded icon and double-click opens the app. Icon assets (`fillbuddy-icon.svg`, `fillbuddy-file-icon.svg`) are already prepared.

### Future (from project brief & competitive analysis)
- **Auto-fill profiles** — Save personal details (name, address, DOB) once, auto-fill across forms
- **Template library** — Pre-loaded popular government/tax forms
- **Smart field detection via OCR** — Tesseract.js for detecting field labels on non-fillable PDFs
- **Batch export** — Fill same form with different data via CSV import
- **Dropdown field support** — Detected but not fully implemented in the form-field engine
