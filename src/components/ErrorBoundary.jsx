import { Component, useEffect, useState } from 'react';
import { db } from '../lib/db.js';

/** Reads each table once and reports what works, so a screenshot of this screen says where it broke. */
function Diagnostics() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const out = [];
      for (const table of db.tables) {
        try {
          const n = (await table.toArray()).length;
          out.push(`${table.name}: ${n} ok`);
        } catch (err) {
          out.push(`${table.name}: ${err?.name || 'Error'}`);
        }
        if (alive) setRows([...out]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return rows.length ? <p className="muted small center error-detail">{rows.join(' · ')}</p> : null;
}

// iOS sometimes drops a Home Screen app's IndexedDB connection while it sits in the background.
// Every query then fails until the page reloads. A reload reconnects, and the journal is untouched.
export function isLostDatabase(err) {
  const text = `${err?.name ?? ''} ${err?.message ?? ''} ${err?.inner?.message ?? ''}`;
  return /Connection to Indexed Database server lost|Database deleted|DatabaseClosed|UnknownError|InvalidStateError|database connection is closing|IDBDatabase/i.test(
    text,
  );
}

const RELOAD_KEY = 'glimmer.recoveredAt';

/** Reloads to recover, unless it already tried within the last 15s (avoids a reload loop). */
export function recoverByReload() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 15000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* storage unavailable: reload anyway */
  }
  window.location.reload();
  return true;
}

/**
 * Catches any error while drawing the app. Without this, one failed database query leaves the
 * whole screen frozen and ignoring taps.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error(error);
    if (isLostDatabase(error)) recoverByReload();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="onboard" role="alert">
        <div className="onboard-inner">
          <div className="empty-art center">🌙</div>
          <h1 className="serif onboard-title">Something went wrong</h1>
          <p className="muted center onboard-lead">
            Your journal is safe on this phone. Reloading usually fixes this.
          </p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Reload Glimmer
          </button>
          <p className="muted small center error-detail">{String(error?.message || error)}</p>
          <Diagnostics />
        </div>
      </div>
    );
  }
}
