import { useState } from 'react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

/**
 * 4-digit entry. `onComplete(code)` resolves true to accept; false shakes and clears.
 * `disabled` pauses input (e.g. during a lockout).
 */
export default function Keypad({ title, subtitle, onComplete, disabled = false }) {
  const [code, setCode] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  const press = async (k) => {
    if (busy || disabled) return;
    if (k === 'del') return setCode((c) => c.slice(0, -1));
    if (!k || code.length >= 4) return;
    const next = code + k;
    setCode(next);
    if (next.length === 4) {
      setBusy(true);
      const ok = await onComplete(next);
      setBusy(false);
      if (!ok) {
        setShake(true);
        navigator.vibrate?.(80);
        setTimeout(() => {
          setShake(false);
          setCode('');
        }, 420);
      } else setCode('');
    }
  };

  return (
    <div className="keypad-wrap">
      <h2 className="serif keypad-title">{title}</h2>
      {subtitle && <p className="muted small center keypad-sub">{subtitle}</p>}
      <div className={`code-dots ${shake ? 'shake' : ''}`} aria-label={`${code.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < code.length ? 'on' : ''} />
        ))}
      </div>
      <div className="keypad">
        {KEYS.map((k, i) =>
          k ? (
            <button
              key={k}
              className={`key ${k === 'del' ? 'key-del' : ''}`}
              onClick={() => press(k)}
              disabled={disabled}
              aria-label={k === 'del' ? 'Delete' : k}
            >
              {k === 'del' ? '⌫' : k}
            </button>
          ) : (
            <span key={`b${i}`} />
          ),
        )}
      </div>
    </div>
  );
}
