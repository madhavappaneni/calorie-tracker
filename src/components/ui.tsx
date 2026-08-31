import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Full-screen view on phones, centred panel over the page on laptops (spec §3.1).
 *  One component, two layouts — the difference is entirely CSS. */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('has-sheet');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('has-sheet');
    };
  }, [onClose]);

  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header className="sheet-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p className="muted small">{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer ? <footer className="sheet-foot">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

/** Numeric input that keeps the raw string while typing (so "1." and "" are allowed)
 *  and reports the parsed value. Uses inputMode=decimal for the phone keypad.
 *
 *  Deliberately always step="any" with no min/max attribute: the browser counts
 *  valid steps from `min`, so `min=1 step=10` would reject 1850, and native
 *  constraint bubbles would pre-empt our own messages. Every numeric rule lives in
 *  JS instead, where it can say something useful. */
export function NumberInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      step="any"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => e.target.select()}
    />
  );
}

/** Servings stepper: ± buttons flanking a numeric field, all ≥44px touch targets. */
export function ServingStepper({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const bump = (delta: number) => {
    const n = Number(value) || 0;
    const next = Math.max(0.25, Math.round((n + delta) * 100) / 100);
    onChange(String(next));
  };
  return (
    <div className="stepper">
      <button type="button" onClick={() => bump(-0.25)} aria-label="Fewer servings">
        −
      </button>
      <NumberInput value={value} onChange={onChange} />
      <button type="button" onClick={() => bump(0.25)} aria-label="More servings">
        +
      </button>
    </div>
  );
}

/** Destructive actions ask once, inline — no dialog stack on a phone. */
export function ConfirmButton({
  label,
  confirmLabel = 'Sure?',
  onConfirm,
  className = 'btn danger',
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className={armed ? `${className} armed` : className}
      onClick={() => {
        if (armed) {
          window.clearTimeout(timer.current);
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
          timer.current = window.setTimeout(() => setArmed(false), 3000);
        }
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

export const Spinner = ({ label = 'Loading…' }: { label?: string }) => (
  <p className="loading" role="status">
    {label}
  </p>
);

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="empty">{children}</p>
);
