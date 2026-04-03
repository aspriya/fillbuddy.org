'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadEngines } from '@/lib/pdf-engine';
import UploadZone from '@/components/UploadZone';
import PdfAnnotator from '@/components/PdfAnnotator';
import type { Annotation } from '@/lib/types';

export default function AppPage() {
  const router = useRouter();
  const [view, setView] = useState<'upload' | 'annotating'>('upload');
  const [ready, setReady] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [initialAnnotations, setInitialAnnotations] = useState<Annotation[]>([]);

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
          setView('annotating');
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
