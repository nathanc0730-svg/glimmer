import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * iOS-style bottom sheet. Slides up, dims the background, and can be dragged down by its
 * handle to dismiss. While closing it keeps rendering its last children so the exit animates.
 */
export default function Sheet({ open, onClose, children, full = false, className = '', label, z = 50 }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState(0);
  const lastChildren = useRef(children);
  const startY = useRef(null);
  const sheetRef = useRef(null);
  if (open) lastChildren.current = children;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setDragY(0);
      return undefined;
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 320);
    return () => clearTimeout(t);
  }, [open]);

  // Force a style flush in the off-screen position, then flip to shown so the slide-up transition runs.
  useLayoutEffect(() => {
    if (open && mounted && !shown && sheetRef.current) {
      sheetRef.current.getBoundingClientRect();
      setShown(true);
    }
  }, [open, mounted, shown]);

  if (!mounted) return null;

  const onTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (startY.current == null) return;
    setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    if (dragY > 110) onClose?.();
    setDragY(0);
    startY.current = null;
  };

  return (
    <div className={`sheet-root ${shown ? 'is-shown' : ''}`} style={{ zIndex: z }} role="dialog" aria-modal="true" aria-label={label}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        ref={sheetRef}
        className={`sheet ${full ? 'sheet-full' : ''} ${className}`}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        {!full && (
          <div className="sheet-grab" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <span />
          </div>
        )}
        {open ? children : lastChildren.current}
      </div>
    </div>
  );
}
