import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db.js';
import { WEEKDAY_SHORT, todayKey, weekKeys } from '../lib/dates.js';
import { KIND_LINES, computeStreaks } from '../lib/streak.js';
import { CheckIcon } from './Icons.jsx';

const COLORS = ['#cdb8ff', '#ffc2de', '#b6e2ff', '#ffe3a8', '#c4f1d9'];

function Confetti() {
  const ref = useRef(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas.width = window.innerWidth * dpr);
    const h = (canvas.height = window.innerHeight * dpr);
    const bits = Array.from({ length: 60 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.42,
      vx: (Math.random() - 0.5) * 14 * dpr,
      vy: (-Math.random() * 13 - 5) * dpr,
      r: (3 + Math.random() * 4) * dpr,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.3,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    let frame;
    const t0 = performance.now();
    const tick = (t) => {
      const age = (t - t0) / 2400;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = Math.max(0, 1 - age);
      for (const b of bits) {
        b.vy += 0.45 * dpr;
        b.vx *= 0.985;
        b.x += b.vx;
        b.y += b.vy;
        b.rot += b.vr;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.r, -b.r / 2, b.r * 2, b.r);
        ctx.restore();
      }
      if (age < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}

/** Gentle celebration after saving. No guilt, no "you lost it" — just a warm nudge. */
export default function StreakCard({ onContinue }) {
  const dates = useLiveQuery(() => db.entries.orderBy('date').uniqueKeys(), [], null);
  const kind = useMemo(() => KIND_LINES[Math.floor(Math.random() * KIND_LINES.length)], []);
  if (!dates) return null;
  const { current } = computeStreaks(dates);
  const set = new Set(dates);
  const today = todayKey();

  return createPortal(
    <div className="streak-overlay" role="dialog" aria-modal="true" aria-label="Entry saved">
      <Confetti />
      <div className="streak-card">
        <div className="streak-flame">🔥</div>
        <h2 className="serif streak-num">
          {current} day streak
        </h2>
        <p className="muted">{current <= 1 ? 'Every beautiful habit starts with one day.' : 'Look at you, showing up for yourself.'}</p>
        <div className="week-row">
          {weekKeys().map((k, i) => (
            <div key={k} className={`week-day ${set.has(k) ? 'done' : ''} ${k === today ? 'today' : ''}`}>
              <span className="dot">{set.has(k) && <CheckIcon size={14} />}</span>
              <span className="label">{WEEKDAY_SHORT[i]}</span>
            </div>
          ))}
        </div>
        <p className="serif kind-line">{kind}</p>
        <button className="btn-primary" onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>,
    document.body,
  );
}
