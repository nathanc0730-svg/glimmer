import { useEffect, useRef, useState } from 'react';
import Toggle from '../components/Toggle.jsx';
import PasscodeSheet from '../components/PasscodeSheet.jsx';
import { BookmarkIcon, ChevronRight } from '../components/Icons.jsx';
import { useSetting, setSetting } from '../lib/db.js';
import { TIMEZONES, defaultTimezone, disableReminder, enableReminder, pushSupport, updateReminder } from '../lib/push.js';
import { buildBackup, formatBytes, readBackup, restoreBackup, storageInfo } from '../lib/backup.js';
import { shareFile } from '../lib/share.js';
import { AFFIRMATIONS } from '../data/affirmations.js';

const REMINDER_DEFAULT = { on: false, time: '20:30', timezone: defaultTimezone() };

function ShortcutSteps() {
  return (
    <details className="shortcut-steps">
      <summary>Use an iPhone Shortcut instead</summary>
      <ol>
        <li>Open the <b>Shortcuts</b> app → <b>Automation</b> → <b>+</b>.</li>
        <li>Choose <b>Time of Day</b>, pick your time, set <b>Repeat: Daily</b>, then <b>Run Immediately</b>.</li>
        <li>Add the action <b>Show Notification</b> with the text “Time to journal ✨”.</li>
        <li>Tap <b>Done</b>. When it buzzes, open Glimmer from your Home Screen.</li>
      </ol>
      <p className="muted small">
        Tip: open Glimmer from its Home Screen icon, not from a Safari link. Your journal lives inside the Home
        Screen app.
      </p>
    </details>
  );
}

function ReminderCard() {
  const [reminder] = useSetting('reminder', REMINDER_DEFAULT);
  const r = { ...REMINDER_DEFAULT, ...reminder };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const support = pushSupport();

  const run = (p) => {
    setBusy(true);
    setError('');
    p.catch((e) => setError(e?.message ?? 'Something went wrong.')).finally(() => setBusy(false));
  };

  // Called straight from the toggle tap so iOS will show the permission prompt.
  const toggle = (on) => run(on ? enableReminder(r.time, r.timezone) : disableReminder());
  const change = (patch) => {
    const next = { ...r, ...patch };
    if (r.on) run(updateReminder(next.time, next.timezone));
    else setSetting('reminder', { ...next, on: false });
  };

  const notes = {
    'not-configured': 'The reminder service hasn’t been set up yet, so push notifications are off for now.',
    'not-installed': 'Open Glimmer from your Home Screen to turn on reminders.',
    denied: 'Notifications are turned off for Glimmer. You can allow them in iPhone Settings → Notifications → Glimmer.',
    unsupported: 'This iPhone needs iOS 16.4 or newer for reminders.',
  };

  return (
    <section className="card settings-card">
      <div className="setting-row">
        <div>
          <div className="setting-title">Daily reminder</div>
          <div className="muted small">A gentle nudge once a day</div>
        </div>
        <Toggle checked={r.on && support.ok} onChange={toggle} label="Daily reminder" disabled={!support.ok || busy} />
      </div>
      {support.ok && (
        <>
          <label className="setting-row">
            <span>Time</span>
            <input
              type="time"
              className="pill-input"
              value={r.time}
              step={300}
              disabled={busy}
              onChange={(e) => e.target.value && change({ time: e.target.value })}
            />
          </label>
          <label className="setting-row">
            <span>Timezone</span>
            <select className="pill-input tz" value={r.timezone} disabled={busy} onChange={(e) => change({ timezone: e.target.value })}>
              {(TIMEZONES.includes(r.timezone) ? TIMEZONES : [r.timezone, ...TIMEZONES]).map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {busy && <p className="muted small">Saving…</p>}
      {error && <p className="error-text small">{error}</p>}
      {!support.ok && <p className="muted small setting-note">{notes[support.reason]}</p>}
      <ShortcutSteps />
    </section>
  );
}

function BackupCard() {
  const [lastBackup, setLastBackup] = useSetting('lastBackupAt', null);
  const [state, setState] = useState({ phase: 'idle' }); // idle | building | ready | restoring
  const [info, setInfo] = useState(null);
  const fileRef = useRef(null);

  const refreshInfo = () => storageInfo().then(setInfo);
  useEffect(() => {
    refreshInfo();
  }, []);

  const prepare = async () => {
    setState({ phase: 'building', done: 0, total: 0 });
    try {
      const file = await buildBackup((done, total) => setState({ phase: 'building', done, total }));
      setState({ phase: 'ready', file });
    } catch (e) {
      console.error(e);
      setState({ phase: 'idle', error: 'The backup couldn’t be created. Please try again.' });
    }
  };

  // A separate tap for sharing: iOS only opens the share sheet straight from a tap.
  const save = async () => {
    if (await shareFile(state.file)) {
      await setLastBackup(new Date().toISOString());
      setState({ phase: 'idle', saved: true });
    }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setState({ phase: 'restoring' });
    try {
      const backup = await readBackup(file);
      const { counts, exportedAt } = backup.journal;
      const when = new Date(exportedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
      const ok = window.confirm(
        `Restore ${counts.entries} entries and ${counts.media} photos/videos from ${when}?\n\nEverything already on this phone stays; matching entries are updated.`,
      );
      if (ok) {
        await restoreBackup(backup);
        window.alert('Your journal has been restored ✨');
      }
      setState({ phase: 'idle' });
      refreshInfo();
    } catch (err) {
      setState({ phase: 'idle', error: err?.message ?? 'That file couldn’t be read.' });
    }
  };

  const lastLabel = lastBackup
    ? new Date(lastBackup).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Never';

  return (
    <section className="card settings-card">
      <div className="setting-row">
        <div>
          <div className="setting-title">Backup</div>
          <div className="muted small">Last backup: {lastLabel}</div>
        </div>
      </div>
      <p className="muted small setting-note">
        Saves a .zip of all your entries, photos and videos. Choose “Save to Files” and pick iCloud Drive to keep it
        safe.
      </p>
      {state.phase === 'ready' ? (
        <button className="btn-wide primary" onClick={save}>
          Save backup ({formatBytes(state.file.size)})
        </button>
      ) : (
        <button className="btn-wide primary" onClick={prepare} disabled={state.phase === 'building' || state.phase === 'restoring'}>
          {state.phase === 'building'
            ? state.total
              ? `Preparing… ${state.done}/${state.total}`
              : 'Preparing…'
            : 'Export backup'}
        </button>
      )}
      <button className="btn-wide" onClick={() => fileRef.current?.click()} disabled={state.phase === 'building' || state.phase === 'restoring'}>
        {state.phase === 'restoring' ? 'Restoring…' : 'Import backup'}
      </button>
      <input ref={fileRef} type="file" accept=".zip,application/zip" hidden onChange={onImport} />
      {state.saved && <p className="ok-text small">Backup saved. Nice work 💜</p>}
      {state.error && <p className="error-text small">{state.error}</p>}
      <div className="storage-row">
        <span className="muted small">Using {formatBytes(info?.usage)} on this iPhone</span>
        <span className={`small ${info?.persisted ? 'ok-text' : 'muted'}`}>{info?.persisted ? 'Protected ✓' : ''}</span>
      </div>
    </section>
  );
}

function PrivacyCard() {
  const [passcode] = useSetting('passcode', null);
  const [mode, setMode] = useState(null);
  return (
    <section className="card settings-card">
      <div className="setting-row">
        <div>
          <div className="setting-title">Passcode lock</div>
          <div className="muted small">Ask for a 4-digit code when Glimmer opens</div>
        </div>
        <Toggle checked={!!passcode} onChange={(on) => setMode(on ? 'set' : 'remove')} label="Passcode lock" />
      </div>
      {passcode && (
        <button className="setting-row link-row" onClick={() => setMode('change')}>
          <span>Change passcode</span>
          <ChevronRight size={18} />
        </button>
      )}
      <p className="muted small setting-note">
        🔒 Your journal stays on this iPhone. No account, no cloud, no tracking. Nothing you write is ever uploaded.
      </p>
      <PasscodeSheet mode={mode} onClose={() => setMode(null)} />
    </section>
  );
}

export default function Settings({ onShowInstall }) {
  const [dailyOn, setDailyOn] = useSetting('dailyPrompt', true);
  const [saved, setSaved] = useSetting('savedAffirmations', []);

  return (
    <div className="screen settings">
      <header className="screen-head">
        <h1 className="serif">Settings</h1>
      </header>

      <h2 className="settings-label">Reminder</h2>
      <ReminderCard />

      <h2 className="settings-label">Prompts</h2>
      <section className="card settings-card">
        <div className="setting-row">
          <div>
            <div className="setting-title">Suggest a new prompt every day</div>
            <div className="muted small">Shown on Home and in your reminder</div>
          </div>
          <Toggle checked={dailyOn} onChange={setDailyOn} label="Suggest a new prompt every day" />
        </div>
      </section>

      <h2 className="settings-label">Privacy</h2>
      <PrivacyCard />

      <h2 className="settings-label">Your data</h2>
      <BackupCard />

      {saved.length > 0 && (
        <>
          <h2 className="settings-label">Saved affirmations</h2>
          <section className="card settings-card">
            {saved.map((i) => (
              <div key={i} className="setting-row affirmation-row">
                <span className="serif">{AFFIRMATIONS[i]}</span>
                <button className="icon-btn small on" aria-label="Remove" onClick={() => setSaved(saved.filter((x) => x !== i))}>
                  <BookmarkIcon size={18} filled />
                </button>
              </div>
            ))}
          </section>
        </>
      )}

      <h2 className="settings-label">About</h2>
      <section className="card settings-card">
        <button className="setting-row link-row" onClick={onShowInstall}>
          <span>How to install on iPhone</span>
          <ChevronRight size={18} />
        </button>
        <p className="muted small setting-note">
          Glimmer 1.0 · made with love, just for you.
        </p>
      </section>
    </div>
  );
}
