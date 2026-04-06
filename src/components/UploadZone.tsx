'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, ArrowLeft, AlertCircle } from 'lucide-react';
import Logo from './Logo';

interface Props {
  onUpload: (file: File) => void;
  onBack: () => void;
  loading: boolean;
  error: string;
}

export default function UploadZone({ onUpload, onBack, loading, error }: Props) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const file = e.dataTransfer?.files?.[0];
      if (file?.type === 'application/pdf' || file?.name.endsWith('.fillbuddy')) onUpload(file);
    },
    [onUpload],
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Nav */}
      <nav className="animate-fade-in flex items-center gap-4 px-6 sm:px-10 py-5 border-b border-slate-200 bg-white">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <div className="flex items-center gap-2 font-heading text-lg font-extrabold text-slate-900 tracking-tight">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-600 to-amber-400 flex items-center justify-center">
            <Logo size={14} className="text-white" />
          </div>
          FillBuddy
        </div>
      </nav>

      {/* Upload area */}
      <div className="animate-fade-up flex-1 flex flex-col items-center justify-center px-6 py-10">
        <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">
          Upload your PDF
        </h2>
        <p className="text-[15px] text-slate-500 mb-10">
          Drop a PDF or saved progress file
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`w-full max-w-lg px-10 py-16 rounded-2xl border-2 border-dashed bg-white cursor-pointer flex flex-col items-center gap-4 transition-all shadow-sm ${
            drag
              ? 'border-amber-500 bg-amber-50/50'
              : 'border-slate-300 hover:border-slate-400'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.fillbuddy"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
            }}
            className="hidden"
          />

          {loading ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                <div className="w-6 h-6 border-[3px] border-amber-200 border-t-amber-600 rounded-full animate-spinner" />
              </div>
              <p className="text-[15px] font-semibold text-slate-900">
                Analyzing form fields...
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
                <Upload size={28} className="text-amber-600" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-slate-900 mb-1">
                  Drop your PDF here or{' '}
                  <span className="text-amber-600">browse</span>
                </p>
                <p className="text-[13px] text-slate-400">
                  PDF &amp; .fillbuddy progress files
                </p>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="animate-fade-in flex items-center gap-2.5 mt-5 px-5 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
            <AlertCircle size={18} /> {error}
          </div>
        )}
      </div>
    </div>
  );
}
