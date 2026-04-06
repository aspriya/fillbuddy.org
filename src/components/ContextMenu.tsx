'use client';

import { useEffect, useRef } from 'react';

/* ── Types ─────────────────────────────────────────────────── */

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
  submenu?: React.ReactNode;
  onClick?: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/* ── Component ─────────────────────────────────────────────── */

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  /* ── Auto-position: flip if near viewport edges ─────────── */
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (rect.right > vw - 8) {
      el.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > vh - 8) {
      el.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  /* ── Close on outside click, scroll, or Escape ──────────── */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = () => onClose();

    // Use setTimeout so the context menu's originating right-click doesn't
    // immediately close it on mousedown
    setTimeout(() => {
      window.addEventListener('mousedown', handleClick);
    }, 0);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 animate-context-menu"
      style={{ left: x, top: y }}
    >
      <div className="bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 py-1.5 min-w-[190px] overflow-hidden">
        {items.map((item, idx) => {
          if (item.divider) {
            return (
              <div
                key={`div-${idx}`}
                className="my-1 border-t border-white/10"
              />
            );
          }

          if (item.submenu) {
            return (
              <div key={item.label}>
                <div className="px-3 py-1.5 flex items-center gap-2.5 text-xs text-gray-300">
                  {item.icon && (
                    <span className="w-4 h-4 flex items-center justify-center opacity-70">
                      {item.icon}
                    </span>
                  )}
                  <span className="flex-1">{item.label}</span>
                </div>
                <div className="px-3 pb-1">{item.submenu}</div>
              </div>
            );
          }

          return (
            <button
              key={item.label}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                item.onClick?.();
                onClose();
              }}
              className={`w-full px-3 py-1.5 flex items-center gap-2.5 text-xs transition-colors
                ${
                  item.disabled
                    ? 'text-gray-600 cursor-not-allowed'
                    : item.danger
                      ? 'text-red-400 hover:bg-red-500/20'
                      : 'text-gray-200 hover:bg-amber-500/20 hover:text-white'
                }
              `}
            >
              {item.icon && (
                <span className="w-4 h-4 flex items-center justify-center opacity-70">
                  {item.icon}
                </span>
              )}
              <span className="flex-1 text-left">{item.label}</span>
              {item.shortcut && (
                <kbd className="text-[10px] font-mono text-gray-500 ml-4">
                  {item.shortcut}
                </kbd>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
