import { createPortal } from 'react-dom';
import { SparkleIcon } from './Icons.jsx';

const ShareGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);
const AddGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

/** Shown in a Safari tab: the journal is only safe once it's opened from the Home Screen. */
export function InstallGuide({ onClose, closeLabel = 'Continue in Safari for now' }) {
  return createPortal(
    <div className="onboard" role="dialog" aria-modal="true" aria-label="Install Glimmer">
      <div className="onboard-inner">
        <div className="lock-logo">
          <SparkleIcon size={30} />
        </div>
        <h1 className="serif onboard-title">Add Glimmer to your Home Screen</h1>
        <p className="muted center onboard-lead">
          Your iPhone keeps your journal safe when Glimmer runs from its Home Screen icon. In a Safari tab, iOS can
          clear it, so please install it first.
        </p>
        <ol className="install-steps">
          <li>
            <span className="step-num">1</span>
            <span>
              Tap the <b>Share</b> button <span className="glyph"><ShareGlyph /></span> in Safari’s toolbar
            </span>
          </li>
          <li>
            <span className="step-num">2</span>
            <span>
              Scroll down and tap <b>Add to Home Screen</b> <span className="glyph"><AddGlyph /></span>
            </span>
          </li>
          <li>
            <span className="step-num">3</span>
            <span>
              Tap <b>Add</b>, then open <b>Glimmer</b> from your Home Screen and journal from there
            </span>
          </li>
        </ol>
        <button className="btn-text onboard-skip" onClick={onClose}>
          {closeLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** First launch from the Home Screen. */
export function Welcome({ onDone }) {
  const start = () => {
    // Close right away; ask iOS to keep this storage in the background. Some iOS versions never
    // answer persist(), so nothing may wait on it.
    onDone();
    try {
      navigator.storage?.persist?.().catch(() => {});
    } catch {
      /* not supported */
    }
  };
  return createPortal(
    <div className="onboard welcome" role="dialog" aria-modal="true" aria-label="Welcome">
      <div className="onboard-inner">
        <div className="lock-logo big">
          <SparkleIcon size={40} />
        </div>
        <h1 className="serif onboard-title">Welcome to Glimmer</h1>
        <p className="muted center onboard-lead">A little space for gratitude, faith and the moments worth keeping.</p>
        <ul className="welcome-points">
          <li>
            <span>✍️</span>
            <span>Tap <b>+</b>, pick a prompt, and write a few lines.</span>
          </li>
          <li>
            <span>📷</span>
            <span>Add photos and videos. They’re saved on this iPhone.</span>
          </li>
          <li>
            <span>🔒</span>
            <span>Private by design: no account, no cloud. Your journal never leaves your phone.</span>
          </li>
          <li>
            <span>💾</span>
            <span>Every so often, use <b>Settings → Export backup</b> to save a copy to iCloud Drive.</span>
          </li>
        </ul>
        <button className="btn-primary" onClick={start}>
          Let’s begin
        </button>
      </div>
    </div>,
    document.body,
  );
}
