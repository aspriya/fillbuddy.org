# FillBuddy — Project Description

> **Last updated:** 2026-04-27
> **Domain:** [fillbuddy.org](https://fillbuddy.org)
> **Status:** Active development — migrated from single-file prototype to Next.js app

---

## What Is FillBuddy?

FillBuddy is a **100% client-side PDF annotation and form-filling web application**. Users upload any PDF (including encrypted ones), annotate it directly in the browser using text, check marks, cross marks, strikeout lines, and signatures, then download the completed PDF — **all without any data ever leaving the browser**.

The core value proposition: **privacy-first PDF filling with save-and-resume capability**. Unlike every competitor (Adobe, Smallpdf, iLovePDF), FillBuddy never uploads files to a server, never requires an account, and never adds watermarks. Its `.fillbuddy` save format preserves full editability of annotations — solving the widespread "tattoo problem" where other tools permanently bake edits into the PDF.

---

## Tech Stack

| Layer          | Technology                                            | Notes                                                                                                    |
| -------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Framework      | **Next.js 16** (App Router)                     | TypeScript,`src/` directory                                                                            |
| React          | **React 19**                                    |                                                                                                          |
| Styling        | **Tailwind CSS 4**                              | PostCSS plugin via `@tailwindcss/postcss`                                                              |
| PDF Parsing    | **pdfjs-dist 3.11.x**                           | Handles encrypted PDFs, renders pages to canvas, extracts annotations                                    |
| PDF Generation | **pdf-lib 1.17.x**                              | Creates/modifies PDFs, embeds text/images, flattens forms                                                |
| Icons          | **lucide-react**                                |                                                                                                          |
| Fonts          | **Inter** (headings) + **Manrope** (body) | Loaded via `next/font/google`. Annotation text uses **Helvetica/Arial** to match pdf-lib export. |
| Hosting        | **Cloudflare Workers** via `@opennextjs/cloudflare` | See `docs/DEPLOYMENT.md`. Single-Worker frontend + (planned) API routes. |
| Analytics DB   | **Cloudflare D1** (planned)               | Anonymous usage events only — see `docs/analytics.md`. Strictly no PDF content, no filenames, no IPs. Country-level geo only. |

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

| Mode                           | How It Works                                                                                                                                    | Output                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Direct** (Strategy 1)  | pdf-lib modifies the original PDF in-place, fills native form fields, then flattens                                                             | Perfect vector output, small file                                         |
| **Overlay** (Strategy 2) | pdfjs-dist renders each page to canvas at 3× scale, pdf-lib creates a new PDF with page images + vector annotations drawn at exact coordinates | Raster background at ~216 DPI, but annotation text/marks are crisp vector |

### The Annotation Approach (Current Primary UX)

The app has **evolved beyond form-field filling** into a general-purpose **PDF annotation tool**. Instead of detecting and mapping form fields to a web form, the current primary workflow renders the PDF visually and lets users **click anywhere to place annotations**.

Annotation types supported:

- **Text** — Click to place, type content, adjustable font size and color, movable/resizable. Rendered in Helvetica/Arial to match pdf-lib's `StandardFonts.Helvetica` used in PDF export — critical for spaced text (boxed form inputs) to align correctly.
- **Check marks (✓)** — Adjustable size and color
- **Cross marks (✗)** — Adjustable size and color
- **Strikeout lines** — Horizontal lines for redlining, adjustable color
- **Signatures** — Draw on canvas or upload image, automatic white background removal

All annotations are movable, resizable, and deletable. Full undo/redo history is supported. Annotations support per-annotation **color** from a 12-color preset palette (black, red, blue, green, purple, orange, yellow, cyan, pink, gray, navy, violet).

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

| Category          | Shortcut                                      | Action                                                |
| ----------------- | --------------------------------------------- | ----------------------------------------------------- |
| **Tools**   | `V` / `T` / `C` / `X` / `L` / `S` | Select / Text / Check / Cross / Strikeout / Signature |
| **Actions** | `Ctrl+Z` / `Ctrl+Shift+Z`                 | Undo / Redo                                           |
|                   | `Ctrl+C` / `Ctrl+V`                       | Copy / Paste annotation                               |
|                   | `Ctrl+S` / `Ctrl+D`                       | Save progress / Download PDF                          |
| **Editing** | `D`                                         | Duplicate selected annotation                         |
|                   | `Delete` / `Backspace`                    | Delete selected                                       |
|                   | `Escape`                                    | Exit edit mode → deselect                            |
|                   | `[` / `]`                                 | Decrease / increase font or mark size                 |
|                   | Arrow keys                                    | Nudge 1px (Shift+Arrow = 10px)                        |
|                   | `?`                                         | Toggle shortcut legend panel                          |

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
- **Two-row sticky toolbar**:
  - **Row 1 (Tools + Actions):** Tool selection (Select, Text, Tick, Cross, Strike, Sign) with keyboard shortcuts + Undo/Redo + Delete + Shortcut legend toggle
  - **Row 2 (Properties, always visible):** 12-color preset palette + Size stepper. When nothing is selected, controls set the **global defaults** for new annotations. When an annotation is selected, controls edit **that annotation's properties** (highlighted in blue) and simultaneously update the global default. Controls are grayed out when the active tool doesn't support them (e.g., Select, Signature).
- Per-annotation two-stage interaction: single click = select (move/resize/copy/delete), double click = edit (type text)
- Undo/redo with full history stacks
- Copy/paste/duplicate annotations with clipboard state
- Arrow key nudging (1px, Shift = 10px)
- **Right-click context menus:**
  - **On annotation:** Copy, Duplicate, Color (inline 12-swatch picker), Font Size (text only), Bring to Front, Send to Back, Delete
  - **On empty area:** Paste at exact click position (disabled when clipboard is empty)
- Comprehensive keyboard shortcuts (see Architecture section above)
- Shortcut legend panel — floating dark overlay toggled via toolbar button or `?` key
- **Save Progress** — exports a `.fillbuddy` JSON file containing the PDF (base64) + all annotations + metadata (save time, page/annotation counts). Shows a **branded success toast** with file details that auto-dismisses after 3 seconds.
- **Download PDF** — calls `exportAnnotatedPdf()` which bakes annotations into a real PDF

### Context Menu (`src/components/ContextMenu.tsx`)

- Reusable, dark-themed glassmorphic context menu component (`bg-gray-900/95 backdrop-blur`)
- Auto-positions to stay within viewport (flips near edges)
- Supports icons, keyboard shortcut labels, dividers, disabled states, danger styling, and inline submenus (used for color picker and font size stepper)
- Dismisses on click-outside, Escape, or scroll
- Animated entrance via `animate-context-menu` keyframe

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
│   │   ├── ContextMenu.tsx     # Reusable dark-themed right-click context menu with submenus
│   │   ├── UploadZone.tsx      # Drag-and-drop PDF / .fillbuddy upload
│   │   └── SignaturePad.tsx    # Draw/upload signature with background removal
│   │
│   ├── lib/
│   │   ├── pdf-engine.ts       # Dual-engine core: loadEngines(), extractFields(), downloadDirect(),
│   │   │                       #   downloadOverlay(), exportAnnotatedPdf(), hexToRgb()
│   │   ├── field-helpers.ts    # Field name cleaning, radio labels, section grouping matchers
│   │   ├── types.ts            # TypeScript interfaces: FormField, RadioOption, EngineMode,
│   │   │                       #   ToolType, Annotation (with color), PageData
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
├── 

---

## Key Design Decisions

### 1. Client-Side Only for PDF Processing
All PDF parsing, annotating, and exporting happens in the browser. The PDF bytes never leave the user's device — this is the core privacy differentiator and the headline marketing claim.

A tiny **anonymous analytics endpoint** (`/api/events` → Cloudflare D1) is planned to count usage (uploads, downloads, saves, resumes) per day/hour/country for product decisions. It records categorical metadata only (event type, country code, device/browser/OS family, page count, file-size bucket, anonymous random IDs). It never sees the PDF, the filename, the annotations, or the user's IP address. See `docs/analytics.md` for the full spec, including the explicit list of fields that are *not* collected. This does not contradict the client-side promise: the file itself still never leaves the browser.

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
  "annotations": [{ "id": "...", "type": "text", "page": 1, "x": 100, "y": 200, "color": "#DC2626", ... }],
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

## SEO & Metadata

- Root layout sets comprehensive `<title>`, `description`, `keywords`, OpenGraph, and Twitter Card metadata
- Landing page includes JSON-LD for `SoftwareApplication` and `FAQPage` schemas
- Canonical URL: `https://fillbuddy.org`
- Server-rendered landing page for crawlability
- FAQ section for long-tail keyword targeting

---

## Planned/Future Features

### Planned (next infra work)
- **Anonymous usage analytics on Cloudflare D1** — Track per-day and per-hour counts of `pdf_upload`, `pdf_download`, `fillbuddy_save`, and `fillbuddy_upload` events with country-level geo and device/browser categories, so we can measure the upload→download funnel and where users come from. No PDF content, no filenames, no IPs are stored. Includes a password-gated `/admin/analytics` SSR dashboard. Full plan in `docs/analytics.md`.

### Recently Implemented
- ~~**Text color changing**~~ ✅ — 12-color preset palette for all annotation types (text, check, cross, strikeout). Unified toolbar row 2 controls both global defaults and per-annotation overrides. Colors export correctly to PDF via `hexToRgb()` conversion. Backward-compatible with existing `.fillbuddy` files (absent `color` defaults to black).
- ~~**Annotation right-click context menu**~~ ✅ — Dark-themed glassmorphic context menu with: Copy, Duplicate, Color (inline 12-swatch picker), Font Size stepper (text only), Bring to Front, Send to Back, Delete. Auto-positions near viewport edges.
- ~~**Empty area right-click context menu**~~ ✅ — Right-clicking empty PDF space shows Paste option at exact click coordinates. Disabled when clipboard is empty.

### Immediate (Next Release)
- **PWA with File Handling API** — Register FillBuddy as a PWA file handler for `.fillbuddy` files so the OS shows a branded icon and double-click opens the app. Icon assets (`fillbuddy-icon.svg`, `fillbuddy-file-icon.svg`) are already prepared.

### Future (from project brief & competitive analysis)
- **Auto-fill profiles** — Save personal details (name, address, DOB) once, auto-fill across forms
- **Template library** — Pre-loaded popular government/tax forms
- **Smart field detection via OCR** — Tesseract.js for detecting field labels on non-fillable PDFs
- **Batch export** — Fill same form with different data via CSV import
- **Dropdown field support** — Detected but not fully implemented in the form-field engine
