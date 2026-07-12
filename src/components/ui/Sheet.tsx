import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  children: ReactNode;
}

export function Sheet({ isOpen, onClose, eyebrow, title, children }: SheetProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      setVisible(false);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Sluiten"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full max-w-full rounded-t-2xl border-t border-slate-800 bg-slate-900 p-5 shadow-2xl transition-all duration-200 sm:max-w-sm sm:rounded-2xl sm:border ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            {eyebrow && (
              <p className="mb-1 text-xs font-medium tracking-wide text-sky-400 uppercase">{eyebrow}</p>
            )}
            <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Sluiten"
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-2 text-sm leading-relaxed text-slate-300">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
