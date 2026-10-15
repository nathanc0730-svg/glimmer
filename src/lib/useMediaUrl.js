import { useEffect, useState } from 'react';
import { db } from './db.js';

/** Loads a media blob from IndexedDB and returns a temporary object URL (revoked on unmount). */
export function useMediaUrl(id, variant = 'thumb') {
  const [state, setState] = useState({ url: null, type: null });
  useEffect(() => {
    setState({ url: null, type: null });
    if (!id) return undefined;
    let alive = true;
    let url = null;
    db.media.get(id).then((m) => {
      if (!alive || !m) return;
      const blob = variant === 'thumb' ? m.thumbBlob ?? (m.type === 'image' ? m.blob : null) : m.blob;
      if (blob) url = URL.createObjectURL(blob);
      setState({ url, type: m.type, duration: m.duration });
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, variant]);
  return state;
}
