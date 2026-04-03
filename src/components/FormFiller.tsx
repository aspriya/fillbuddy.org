'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  FileText,
  Download,
  Check,
  Search,
  X,
  ChevronDown,
  Lock,
  Unlock,
} from 'lucide-react';
import type { FormField, EngineMode } from '@/lib/types';
import { cleanFieldName, getSection } from '@/lib/field-helpers';
import FieldRenderer from './FieldRenderer';

interface Props {
  fields: FormField[];
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
  onDownload: () => Promise<void>;
  fileName: string;
  onBack: () => void;
  saving: boolean;
  mode: EngineMode;
}

export default function FormFiller({
  fields,
  values,
  onChange,
  onDownload,
  fileName,
  onBack,
  saving,
  mode,
}: Props) {
  const [search, setSearch] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [downloadDone, setDownloadDone] = useState(false);

  // Group fields into sections
  const sections: Record<string, { label: string; fields: FormField[] }> = {};
  const sectionOrder: string[] = [];

  fields.forEach((f) => {
    const sec = getSection(f.name);
    if (!sections[sec.key]) {
      sections[sec.key] = { label: sec.label, fields: [] };
      sectionOrder.push(sec.key);
    }
    sections[sec.key].fields.push(f);
  });

  // Open all sections by default when fields change
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    sectionOrder.forEach((k) => (initial[k] = true));
    setOpenSections(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.length]);

  const filled = Object.values(values).filter(
    (v) => v !== '' && v !== false && v != null,
  ).length;

  // Filter sections by search
  const filteredSections = search
    ? Object.fromEntries(
        Object.entries(sections)
          .map(([k, s]) => [
            k,
            {
              ...s,
              fields: s.fields.filter((f) =>
                cleanFieldName(f.name)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              ),
            },
          ])
          .filter(([, s]) => (s as { fields: FormField[] }).fields.length > 0),
      )
    : sections;

  const handleDownload = async () => {
    await onDownload();
    setDownloadDone(true);
    setTimeout(() => setDownloadDone(false), 3000);
  };

  const progressPercent =
    fields.length > 0 ? (filled / fields.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ─── Sticky header ─── */}
      <div className="animate-fade-in bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 max-w-4xl mx-auto flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <ArrowLeft size={18} className="text-slate-500" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <FileText size={16} className="text-amber-600" />
                <span className="text-sm font-bold text-slate-900">
                  {fileName}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                    mode === 'direct'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'bg-blue-50 text-blue-600 border border-blue-200'
                  }`}
                >
                  {mode === 'direct' ? (
                    <Unlock size={10} />
                  ) : (
                    <Lock size={10} />
                  )}
                  {mode === 'direct' ? 'Direct Fill' : 'Visual Overlay'}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {filled} of {fields.length} fields filled
              </span>
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={saving}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-md cursor-pointer ${
              downloadDone
                ? 'bg-emerald-500'
                : 'bg-gradient-to-br from-amber-600 to-amber-700 hover:shadow-lg'
            } ${saving ? 'opacity-70 cursor-wait' : ''}`}
          >
            {downloadDone ? (
              <>
                <Check size={16} /> Downloaded!
              </>
            ) : saving ? (
              'Processing...'
            ) : (
              <>
                <Download size={16} /> Download PDF
              </>
            )}
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-[3px] bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-r-sm transition-[width] duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ─── Search ─── */}
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-8 pt-5">
        <div className="animate-fade-up relative">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 text-sm bg-white transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 placeholder:text-slate-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <X size={16} className="text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* ─── Sections ─── */}
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-8 pt-4 pb-24">
        {(search ? Object.keys(filteredSections) : sectionOrder).map(
          (key, idx) => {
            const sec =
              (filteredSections as Record<string, { label: string; fields: FormField[] }>)[key] ||
              sections[key];
            if (!sec || !sec.fields.length) return null;

            const isOpen = search || openSections[key] !== false;
            const hasFilledField = sec.fields.some(
              (f: FormField) => values[f.name] && values[f.name] !== false,
            );

            return (
              <div
                key={key}
                className={`animate-fade-up ${
                  idx <= 3 ? `anim-delay-${idx + 1}` : ''
                } mb-3`}
              >
                <button
                  type="button"
                  onClick={() =>
                    !search &&
                    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                  className={`flex items-center justify-between w-full px-5 py-3.5 bg-white border border-slate-200 cursor-pointer transition-all ${
                    isOpen ? 'rounded-t-2xl' : 'rounded-2xl'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        hasFilledField ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                    <span className="font-heading text-sm font-bold text-slate-900">
                      {sec.label}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {sec.fields.length}
                    </span>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`text-slate-400 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="bg-white border border-slate-200 border-t-0 rounded-b-2xl px-5 pb-4 pt-2">
                    {sec.fields.map((f: FormField) => (
                      <FieldRenderer
                        key={f.name}
                        field={f}
                        value={values[f.name]}
                        onChange={(v) => onChange(f.name, v)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          },
        )}

        {search && Object.keys(filteredSections).length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Search size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-[15px] font-medium">
              No fields match &ldquo;{search}&rdquo;
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
