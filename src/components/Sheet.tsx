import { useEffect } from 'react';
import type { ReactNode } from 'react';

export function Sheet({ onClose, children, title }: { onClose: () => void; children: ReactNode; title?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </>
  );
}

export function Confirm({
  title,
  body,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet onClose={onCancel} title={title}>
      {body && <p className="muted small" style={{ margin: '8px 0 0' }}>{body}</p>}
      <div className="row mt16">
        <button className="btn btn--ghost grow" onClick={onCancel}>
          Cancel
        </button>
        <button className={`btn grow ${danger ? 'btn--danger' : ''}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
