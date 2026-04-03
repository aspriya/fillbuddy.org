'use client';

import { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

export default function SignaturePad({ onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [mode, setMode] = useState<'draw' | 'upload'>('draw');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
    setDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasContent(true);
  };

  const endDraw = () => setDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
  };

  function removeBackground(canvas: HTMLCanvasElement, threshold = 230): string {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > threshold && d[i + 1] > threshold && d[i + 2] > threshold) {
        d[i + 3] = 0;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  const handleSave = () => {
    const canvas = canvasRef.current!;
    onSave(removeBackground(canvas));
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.9;
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      setHasContent(true);
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-bold text-gray-900">
            Create Signature
          </h3>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setMode('draw'); clear(); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'draw' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Draw
          </button>
          <button
            onClick={() => setMode('upload')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'upload' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Upload Image
          </button>
        </div>

        {mode === 'draw' && (
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm text-gray-500">Stroke:</span>
            <input
              type="range"
              min={1}
              max={6}
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="w-24 accent-amber-600"
            />
          </div>
        )}

        {mode === 'upload' && (
          <div className="mb-3">
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
            />
          </div>
        )}

        <div className="border rounded-xl overflow-hidden bg-white mb-4">
          <canvas
            ref={canvasRef}
            width={500}
            height={200}
            className="w-full cursor-crosshair touch-none"
            onMouseDown={mode === 'draw' ? startDraw : undefined}
            onMouseMove={mode === 'draw' ? draw : undefined}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={mode === 'draw' ? startDraw : undefined}
            onTouchMove={mode === 'draw' ? draw : undefined}
            onTouchEnd={endDraw}
          />
        </div>

        <p className="text-xs text-gray-400 mb-4">
          White background will be automatically removed
        </p>

        <div className="flex justify-end gap-3">
          {mode === 'draw' && (
            <button
              onClick={clear}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Clear
            </button>
          )}
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasContent}
            className="px-6 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-40"
          >
            Use Signature
          </button>
        </div>
      </div>
    </div>
  );
}
