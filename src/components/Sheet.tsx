import { useEffect } from 'react';
import type { ReactNode } from 'react';

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
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
      <div className="sheet" role="dialog" aria-modal="true">
        {children}
      </div>
    </>
  );
}

export function Confirm({
  title,
  body,
  confirmLabel = 'CONFIRM',
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
    <Sheet onClose={onCancel}>
      <div className="tiny faint">CONFIRM</div>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.06em', marginTop: 6 }}>{title}</div>
      {body && <p className="dim small">{body}</p>}
      <div className="row mt16" style={{ gap: 10 }}>
        <button className="btn btn--ghost" style={{ flex: 1 }} onClick={onCancel}>
          CANCEL
        </button>
        <button className={`btn ${danger ? 'btn--danger' : ''}`} style={{ flex: 1 }} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
