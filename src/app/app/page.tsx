'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadEngines } from '@/lib/pdf-engine';
import UploadZone from '@/components/UploadZone';
import PdfAnnotator from '@/components/PdfAnnotator';
import type { Annotation } from '@/lib/types';
import { FileText, PenLine, Clock } from 'lucide-react';
import Logo from '@/components/Logo';

interface FillbuddyMeta {
  fileName: string;
  savedAt?: string;
  pageCount?: number;
  annotationCount?: number;
}

export default function AppPage() {
  const router = useRouter();
  const [view, setView] = useState<'upload' | 'resuming' | 'annotating'>('upload');
  const [ready, setReady] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [initialAnnotations, setInitialAnnotations] = useState<Annotation[]>([]);
  const [resumeMeta, setResumeMeta] = useState<FillbuddyMeta | null>(null);

  useEffect(() => {
    loadEngines()
      .then(() => setReady(true))
      .catch(console.error);
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!ready) {
        setError('PDF engines are still loading...');
        return;
      }

      setLoading(true);
      setError('');

      try {
        if (file.name.endsWith('.fillbuddy')) {
          const text = await file.text();
          const data = JSON.parse(text);
          if (data.version !== 1) throw new Error('Unsupported save file version');
          const binary = atob(data.pdfBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          setPdfBytes(bytes);
          setFileName(data.fileName);
          setInitialAnnotations(data.annotations || []);

          setResumeMeta({
            fileName: data.fileName,
            savedAt: data.savedAt,
            pageCount: data.pageCount ?? data.annotations?.length ? undefined : 0,
            annotationCount: data.annotationCount ?? data.annotations?.length ?? 0,
          });
          setView('resuming');

          setTimeout(() => setView('annotating'), 2000);
        } else {
          const bytes = await file.arrayBuffer();
          setPdfBytes(new Uint8Array(bytes));
          setFileName(file.name);
          setInitialAnnotations([]);
          setView('annotating');
        }
      } catch (e: any) {
        setError(e.message || 'Could not load this file.');
      }

      setLoading(false);
    },
    [ready],
  );

  if (view === 'resuming' && resumeMeta) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
        <div className="animate-fade-up max-w-sm w-full">
          {/* Branded file card */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            {/* Header gradient */}
            <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 px-6 py-8 flex flex-col items-center">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                  <Logo size={24} className="text-amber-600" />
                </div>
              </div>
              <span className="text-xs font-bold text-amber-100 tracking-widest uppercase">.fillbuddy</span>
            </div>

            {/* File info */}
            <div className="px-6 py-5">
              <h3 className="font-heading font-bold text-slate-900 text-lg truncate mb-3">
                {resumeMeta.fileName.replace(/\.pdf$/i, '')}
              </h3>

              <div className="space-y-2.5">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <FileText size={15} className="text-slate-400 flex-shrink-0" />
                  <span>
                    {resumeMeta.pageCount != null
                      ? `${resumeMeta.pageCount} page${resumeMeta.pageCount !== 1 ? 's' : ''}`
                      : 'PDF document'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <PenLine size={15} className="text-slate-400 flex-shrink-0" />
                  <span>
                    {resumeMeta.annotationCount != null
                      ? `${resumeMeta.annotationCount} annotation${resumeMeta.annotationCount !== 1 ? 's' : ''}`
                      : 'Saved progress'}
                  </span>
                </div>
                {resumeMeta.savedAt && (
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <Clock size={15} className="text-slate-400 flex-shrink-0" />
                    <span>
                      Saved {new Date(resumeMeta.savedAt).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Loading bar */}
            <div className="px-6 pb-6">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full animate-resume-bar" />
                </div>
                <span className="text-xs font-medium text-slate-400">Resuming…</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'annotating' && pdfBytes) {
    return (
      <PdfAnnotator
        pdfBytes={pdfBytes}
        fileName={fileName}
        onBack={() => {
          setView('upload');
          setPdfBytes(null);
          setFileName('');
          setError('');
          setInitialAnnotations([]);
        }}
        initialAnnotations={initialAnnotations}
      />
    );
  }

  return (
    <UploadZone
      onUpload={handleUpload}
      onBack={() => router.push('/')}
      loading={loading}
      error={error}
    />
  );
}
