'use client';

import { Check } from 'lucide-react';
import { cleanFieldName } from '@/lib/field-helpers';
import type { FormField } from '@/lib/types';

interface Props {
  field: FormField;
  value: any;
  onChange: (value: any) => void;
}

export default function FieldRenderer({ field, value, onChange }: Props) {
  const label = cleanFieldName(field.name);

  if (field.type === 'radio') {
    return (
      <div className="py-3 border-b border-slate-100">
        <label className="block text-[13px] font-semibold text-slate-700 mb-2.5">
          {label}
        </label>
        <div className="flex flex-wrap gap-2">
          {field.options?.map((o) => {
            const selected = value === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange(o.value)}
                className={`px-4 py-2 rounded-lg text-[13px] font-semibold cursor-pointer transition-all ${
                  selected
                    ? 'bg-amber-50 border-[1.5px] border-amber-600 text-amber-800'
                    : 'bg-slate-50 border-[1.5px] border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <div className="py-3 border-b border-slate-100 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`w-[22px] h-[22px] rounded-md flex items-center justify-center shrink-0 cursor-pointer transition-all ${
            value
              ? 'bg-gradient-to-br from-amber-600 to-amber-700'
              : 'bg-white border-2 border-slate-300'
          }`}
        >
          {value && <Check size={14} className="text-white" strokeWidth={3} />}
        </button>
        <label
          className="text-[13px] font-semibold text-slate-700 cursor-pointer select-none"
          onClick={() => onChange(!value)}
        >
          {label}
        </label>
      </div>
    );
  }

  return (
    <div className="py-3 border-b border-slate-100">
      <label className="block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide uppercase">
        {label}
      </label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${label.toLowerCase()}`}
        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-slate-50/50 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 placeholder:text-slate-400"
      />
    </div>
  );
}
