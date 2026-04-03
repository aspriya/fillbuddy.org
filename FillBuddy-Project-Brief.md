# FillBuddy — Project Brief & Next.js Migration Roadmap

## What We Built

### Overview

**FillBuddy** is a 100% client-side PDF form filler application. Users upload any fillable PDF, get a clean web form interface mapped to the PDF's fields, fill it out, and download the completed PDF — all without any data leaving the browser.

### Live Prototype

The current prototype is a single-file React component (`fillbuddy.jsx`) that demonstrates the full flow:

```
Landing Page → Upload PDF → Fill Form → Download Filled PDF
```

### Architecture: Dual-Engine Approach

The core innovation is a **hybrid pdf.js + pdf-lib engine** that handles both normal and encrypted PDFs — a common real-world problem since many bank/government forms ship with owner-password encryption.

#### Engine Pipeline

```
User uploads PDF
        │
        ▼
┌─ Strategy 1: pdf-lib (direct) ──────────────┐
│  Try PDFDocument.load() → getForm().getFields()│
│  If fields found → mode = "direct"            │
└──────────────────────────────────────────────┘
        │ (fails for encrypted PDFs)
        ▼
┌─ Strategy 2: pdf.js (overlay) ──────────────┐
│  pdfjsLib.getDocument() handles decryption    │
│  page.getAnnotations() extracts fields        │
│  Stores field rects + page numbers            │
│  mode = "overlay"                             │
└──────────────────────────────────────────────┘
```

#### Download Strategies

| Mode | How It Works | Output Quality |
|------|-------------|----------------|
| **Direct** | pdf-lib fills native form fields, then flattens | Perfect — vector, searchable, small file |
| **Overlay** | pdf.js renders pages to canvas at 3x, pdf-lib creates new PDF with page images + vector text overlaid at exact field coordinates | Very good — background is rasterized at 216 DPI, but field values are crisp vector text |

### Field Types Handled

- **Text fields** (`/Tx`) — rendered as text inputs with cleaned labels
- **Radio groups** (`/Btn` with `radioButton`) — rendered as selectable pill buttons, grouped by field name
- **Checkboxes** (`/Btn` with `checkBox`) — rendered as toggle checkboxes
- **Dropdowns** (`/Ch`) — detected but not yet fully styled (future)

### UI Features

- Animated dark-theme landing page with gradient mesh background
- Drag-and-drop PDF upload with visual feedback
- Smart field grouping into collapsible sections (Personal Info, Employment, Spouse, etc.)
- Field search/filter
- Progress bar showing fill completion
- Mode indicator badge (Direct Fill / Visual Overlay)
- Download with success feedback

### Libraries Used (loaded via CDN in prototype)

| Library | Version | Purpose |
|---------|---------|---------|
| **pdf-lib** | 1.17.1 | PDF creation, field filling, text overlay, PDF save |
| **pdf.js** | 3.11.174 | PDF parsing, encrypted PDF decryption, annotation extraction, page rendering |
| **lucide-react** | — | Icons |

### Fonts

- **Syne** (headings) — geometric, distinctive
- **Manrope** (body) — clean, modern

### Color System

- Landing: Dark (#0a0a0a) with amber accent (#d97706 → #f59e0b gradient)
- App: Light (#f8fafc) with amber accent buttons and green/blue status badges

---

## What Needs to Happen for Next.js

### 1. Project Scaffolding

```bash
npx create-next-app@latest fillbuddy --typescript --tailwind --app --src-dir
cd fillbuddy
npm install pdf-lib pdfjs-dist lucide-react
```

Key decisions:
- Use **App Router** (`/app` directory)
- TypeScript for type safety
- Tailwind CSS (replace all inline styles)
- `src/` directory structure

### 2. Proposed File Structure

```
fillbuddy/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout, font loading, metadata
│   │   ├── page.tsx                # Landing page (server component for SEO)
│   │   ├── globals.css             # Tailwind + custom animations
│   │   └── app/
│   │       └── page.tsx            # Main app page (upload → fill → download)
│   │
│   ├── components/
│   │   ├── landing/
│   │   │   ├── Hero.tsx
│   │   │   ├── Features.tsx
│   │   │   ├── HowItWorks.tsx
│   │   │   └── Footer.tsx
│   │   ├── app/
│   │   │   ├── UploadZone.tsx
│   │   │   ├── FormFiller.tsx
│   │   │   ├── FieldRenderer.tsx
│   │   │   ├── SectionGroup.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── DownloadBar.tsx
│   │   └── ui/
│   │       ├── Logo.tsx
│   │       ├── Button.tsx
│   │       └── Badge.tsx
│   │
│   ├── lib/
│   │   ├── pdf-engine.ts           # Core dual-engine logic
│   │   ├── field-extract-pdflib.ts # Strategy 1: pdf-lib extraction
│   │   ├── field-extract-pdfjs.ts  # Strategy 2: pdf.js extraction
│   │   ├── download-direct.ts      # Direct fill + flatten
│   │   ├── download-overlay.ts     # Canvas render + overlay
│   │   ├── field-helpers.ts        # Name cleaning, section mapping, radio labels
│   │   └── types.ts                # TypeScript interfaces
│   │
│   ├── hooks/
│   │   ├── usePdfEngine.ts         # Hook wrapping the dual-engine logic
│   │   └── useFormState.ts         # Hook for field values + progress tracking
│   │
│   └── config/
│       ├── sections.ts             # Section definitions and matchers
│       └── radio-labels.ts         # Radio button display labels
│
├── public/
│   ├── og-image.png                # Open Graph image for social sharing
│   └── favicon.ico
│
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

### 3. Key Migration Tasks

#### 3a. Font Loading — Use `next/font`

```typescript
// src/app/layout.tsx
import { Syne, Manrope } from 'next/font/google';

const syne = Syne({ subsets: ['latin'], variable: '--font-syne' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });

export default function RootLayout({ children }) {
  return (
    <html className={`${syne.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

This replaces the Google Fonts `@import` with Next.js optimized font loading (self-hosted, no layout shift).

#### 3b. PDF Libraries — Dynamic Import (Client Only)

pdf-lib and pdf.js use browser APIs (`canvas`, `Blob`, `FileReader`). They must be loaded client-side only.

```typescript
// src/lib/pdf-engine.ts
export async function loadEngines() {
  const [pdfLib, pdfjs] = await Promise.all([
    import('pdf-lib'),
    import('pdfjs-dist'),
  ]);

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  return { pdfLib, pdfjs };
}
```

The app page must be a client component:

```typescript
// src/app/app/page.tsx
'use client';

import { usePdfEngine } from '@/hooks/usePdfEngine';
// ...
```

#### 3c. Landing Page — Server Component for SEO

The landing page has no interactivity until the user clicks "Get Started". Make it a server component for fast initial load and SEO:

```typescript
// src/app/page.tsx (server component)
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import Link from 'next/link';

export const metadata = {
  title: 'FillBuddy — Fill Any PDF Form Online',
  description: 'Upload any fillable PDF, get a clean form, fill and download. 100% client-side.',
  openGraph: { /* ... */ },
};

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Features />
      {/* CTA links to /app */}
      <Link href="/app">Get Started</Link>
    </main>
  );
}
```

#### 3d. Replace Inline Styles with Tailwind

All inline styles should be converted to Tailwind utility classes. Custom animations go in `globals.css`:

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .animate-gradient {
    background-size: 400% 400%;
    animation: gradient-shift 15s ease infinite;
  }
}

@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
```

Extend `tailwind.config.ts` for the custom color palette:

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        amber: { 600: '#d97706' }, // already in Tailwind
        // custom tokens if needed
      },
      fontFamily: {
        heading: ['var(--font-syne)', 'sans-serif'],
        body: ['var(--font-manrope)', 'sans-serif'],
      },
    },
  },
};
```

#### 3e. TypeScript Interfaces

```typescript
// src/lib/types.ts
export interface FormField {
  name: string;
  type: 'text' | 'radio' | 'checkbox' | 'dropdown';
  page?: number;
  rect?: [number, number, number, number];
  value?: string;
  options?: RadioOption[];
  pdfLib?: boolean; // true if extracted via pdf-lib (direct mode)
}

export interface RadioOption {
  value: string;
  label: string;
  rect?: [number, number, number, number];
  page?: number;
}

export type EngineMode = 'direct' | 'overlay';

export interface PdfEngineResult {
  fields: FormField[];
  mode: EngineMode;
}
```

#### 3f. Custom Hook for PDF Engine

```typescript
// src/hooks/usePdfEngine.ts
'use client';

import { useState, useCallback, useRef } from 'react';
import type { FormField, EngineMode, PdfEngineResult } from '@/lib/types';

export function usePdfEngine() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [mode, setMode] = useState<EngineMode>('direct');
  const enginesRef = useRef(null);

  // Initialize engines
  const init = useCallback(async () => { /* ... */ }, []);

  // Upload and extract
  const upload = useCallback(async (file: File) => { /* ... */ }, []);

  // Download filled PDF
  const download = useCallback(async (values: Record<string, any>, fileName: string) => { /* ... */ }, [mode]);

  return { ready, loading, error, fields, mode, init, upload, download };
}
```

### 4. Future Feature Roadmap

#### Phase 1: Core Next.js App (MVP)
- [ ] Scaffold Next.js project with structure above
- [ ] Migrate landing page as server component
- [ ] Migrate app page as client component with `usePdfEngine` hook
- [ ] Convert all inline styles to Tailwind
- [ ] Add TypeScript interfaces
- [ ] Add `next/font` for Syne + Manrope
- [ ] Add SEO metadata + Open Graph image
- [ ] Deploy to Vercel

#### Phase 2: Enhanced UX
- [ ] PDF preview panel alongside the form (render pages with pdf.js in a sidebar)
- [ ] Field highlight — click a field in the form, highlight its position on the PDF preview
- [ ] Multi-page navigation tabs in the form filler
- [ ] Auto-save form progress to localStorage
- [ ] Dark mode toggle for the app interface
- [ ] Mobile-responsive form layout
- [ ] Keyboard navigation between fields (Tab support)

#### Phase 3: Non-Fillable PDF Support (Approach 2/3)
- [ ] Detect non-fillable PDFs (0 form fields in both engines)
- [ ] Render PDF pages with pdf.js
- [ ] Let users click on the PDF to place text fields at custom positions
- [ ] Implement a coordinate-based text overlay system
- [ ] Support drawing signatures (canvas-based signature pad)
- [ ] This enables filling ANY PDF, even scanned ones

#### Phase 4: Server-Side Enhancement (Optional)
- [ ] Add API route (`/api/decrypt`) using `qpdf` for server-side PDF decryption
- [ ] This produces perfect vector output even for encrypted PDFs (vs. rasterized overlay)
- [ ] Add API route (`/api/ocr`) for scanned PDF text recognition
- [ ] Rate limiting and file size validation

#### Phase 5: Productization
- [ ] User accounts (NextAuth.js) for saving form templates
- [ ] Template library — pre-built field mappings for common forms (bank apps, visa forms, tax forms)
- [ ] Batch filling — upload a CSV and fill multiple copies of the same form
- [ ] Form sharing — generate a link where others can fill the same PDF
- [ ] White-label / embeddable widget version
- [ ] Monetization: free tier (3 PDFs/day) + paid tier (unlimited)
- [ ] Analytics dashboard

### 5. Testing Notes from Current Prototype

#### Tested Successfully
- Commercial Bank of Ceylon credit card application (encrypted, 113 fields, 2 pages)
- Dual-engine fallback works: pdf-lib fails on encrypted → pdf.js picks up all fields
- Radio groups correctly grouped with proper button values
- Text overlay positions align with original PDF field rectangles
- Download produces valid PDF with filled values

#### Known Limitations to Address
- **Overlay mode file size**: PNG page images at 3x scale produce larger files (~2-5 MB for 2 pages). Could optimize with JPEG or lower scale for non-print use cases.
- **Font matching**: Overlay mode uses Helvetica for filled text. Original form may use different fonts. Could embed matched fonts for visual consistency.
- **Text overflow**: Long text values may overflow field rectangles. Need to add text truncation or font-size reduction logic.
- **Dropdown fields**: Detected but not yet rendered with a proper select/dropdown UI component.
- **Date fields**: Currently plain text inputs. Could add date picker UI for fields named DOB, Date, etc.
- **Field validation**: No validation yet (e.g., NIC format, phone number format, date format DD/MM/YY).

---

## Quick Start for Next.js Migration

```bash
# 1. Create project
npx create-next-app@latest fillbuddy --typescript --tailwind --app --src-dir
cd fillbuddy

# 2. Install dependencies
npm install pdf-lib pdfjs-dist lucide-react

# 3. Copy the engine logic from fillbuddy.jsx into:
#    - src/lib/pdf-engine.ts (extraction + download logic)
#    - src/lib/field-helpers.ts (cleanFieldName, sections, radio labels)
#    - src/lib/types.ts (interfaces)

# 4. Build components from the prototype's JSX
#    - Split Landing, UploadZone, FormFiller, FieldRenderer into separate files
#    - Convert inline styles → Tailwind classes

# 5. Run
npm run dev
```

---

*Document generated from FillBuddy prototype session — April 2026*
