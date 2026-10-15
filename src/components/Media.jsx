import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMediaUrl } from '../lib/useMediaUrl.js';
import { CloseIcon, PlayIcon } from './Icons.jsx';

function useInView(enabled) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(!enabled);
  useEffect(() => {
    if (!enabled || seen || !ref.current || !('IntersectionObserver' in window)) {
      if (enabled && !seen && !('IntersectionObserver' in window)) setSeen(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (items) => {
        if (items.some((i) => i.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [enabled, seen]);
  return [ref, seen];
}

/** Thumbnail image (with a play badge for videos) that fills its parent. `lazy` waits until near the viewport. */
export function MediaImage({ id, lazy = false }) {
  const [ref, seen] = useInView(lazy);
  const { url, type } = useMediaUrl(seen ? id : null, 'thumb');
  return (
    <span className="media-image" ref={ref}>
      {url ? <img src={url} alt="" draggable="false" /> : <span className="media-fallback" />}
      {type === 'video' && (
        <span className="play-badge">
          <PlayIcon size={14} />
        </span>
      )}
    </span>
  );
}

export function MediaThumb({ id, onClick, className = '', children }) {
  return (
    <button type="button" className={`media-thumb ${className}`} onClick={onClick} aria-label="Photo or video">
      <MediaImage id={id} />
      {children}
    </button>
  );
}

function Slide({ id, active }) {
  const { url, type } = useMediaUrl(id, 'full');
  const videoRef = useRef(null);
  useEffect(() => {
    if (!active) videoRef.current?.pause();
  }, [active]);
  if (!url) return <div className="viewer-slide" />;
  return (
    <div className="viewer-slide">
      {type === 'video' ? (
        <video ref={videoRef} src={url} controls playsInline preload="metadata" />
      ) : (
        <img src={url} alt="" draggable="false" />
      )}
    </div>
  );
}

/** Full-screen, swipeable photo/video viewer. Videos play inline (no iOS fullscreen takeover). */
export function MediaViewer({ ids, start = 0, onClose }) {
  const [index, setIndex] = useState(start);
  const track = useRef(null);

  useEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = start * el.clientWidth;
  }, [start]);

  const onScroll = () => {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Media viewer">
      <button className="icon-btn viewer-close" onClick={onClose} aria-label="Close">
        <CloseIcon size={22} />
      </button>
      <div className="viewer-track" ref={track} onScroll={onScroll}>
        {ids.map((id, i) => (
          <Slide key={id} id={id} active={i === index} />
        ))}
      </div>
      {ids.length > 1 && (
        <div className="viewer-dots">
          {ids.map((id, i) => (
            <span key={id} className={i === index ? 'on' : ''} />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
