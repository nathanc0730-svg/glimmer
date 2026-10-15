import { useRef } from 'react';
import { WEEKDAY_SHORT, addMonths, formatMonth, monthOf, monthWeeks, todayKey } from '../lib/dates.js';
import { ChevronRight } from './Icons.jsx';

/**
 * Swipeable Monday-first month grid. `renderDay(key)` fills each in-month cell;
 * months after the current one are not reachable.
 */
export default function MonthCalendar({ month, onMonthChange, renderDay, onDayClick, footer }) {
  const today = todayKey();
  const canNext = month < monthOf(today);
  const start = useRef(null);

  const go = (n) => {
    if (n > 0 && !canNext) return;
    onMonthChange(addMonths(month, n));
  };

  const onTouchStart = (e) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e) => {
    if (!start.current) return;
    const dx = e.changedTouches[0].clientX - start.current.x;
    const dy = e.changedTouches[0].clientY - start.current.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    start.current = null;
  };

  return (
    <div className="calendar" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="cal-head">
        <button className="icon-btn small" onClick={() => go(-1)} aria-label="Previous month">
          <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <h3 className="serif">{formatMonth(month)}</h3>
        <button className="icon-btn small" onClick={() => go(1)} disabled={!canNext} aria-label="Next month">
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="cal-grid cal-weekdays">
        {WEEKDAY_SHORT.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="cal-grid" key={month}>
        {monthWeeks(month)
          .flat()
          .map((key, i) =>
            key ? (
              <button
                key={key}
                className={`cal-day ${key === today ? 'today' : ''} ${key > today ? 'future' : ''}`}
                onClick={() => key <= today && onDayClick?.(key)}
                disabled={key > today}
              >
                {renderDay(key)}
              </button>
            ) : (
              <span key={`b${i}`} />
            ),
          )}
      </div>
      {footer}
    </div>
  );
}
