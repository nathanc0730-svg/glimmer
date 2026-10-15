import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { getSetting, syncSeedPrompts } from './lib/db.js';
import './styles.css';

// Ask iOS to treat this storage as persistent so the journal isn't evicted.
navigator.storage?.persist?.().catch(() => {});

// Home Screen apps on iPhone usually resume rather than relaunch, so check for a new version
// whenever she comes back, and refresh quietly unless she's in the middle of something.
const busy = () => !!document.querySelector('.sheet-root, .story, .viewer, .streak-overlay, .onboard');
const currentBundle = () => [...document.scripts].map((s) => s.src).find((src) => /assets\/index-[^/]+\.js$/.test(src));

async function checkForUpdate(reg) {
  reg?.update().catch(() => {});
  try {
    const files = await fetch('./asset-list.json', { cache: 'no-store' }).then((r) => r.json());
    const latest = files.find((f) => /^assets\/index-[^/]+\.js$/.test(f));
    const current = currentBundle();
    if (!latest || !current || current.endsWith(latest) || busy()) return;
    // Guard against a reload loop if the new version can't be fetched.
    if (sessionStorage.getItem('glimmer.reloadedFor') === latest) return;
    sessionStorage.setItem('glimmer.reloadedFor', latest);
    window.location.reload();
  } catch {
    /* offline: try again next time */
  }
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => null);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate(reg);
    });
  });
}

// Read the lock + onboarding state before the first paint so nothing flashes behind the lock.
async function boot() {
  await syncSeedPrompts().catch((err) => console.error('Prompt seed failed', err));
  const [passcode, onboarded] = await Promise.all([
    getSetting('passcode', null).catch(() => null),
    getSetting('onboarded', false).catch(() => false),
  ]);
  return { locked: !!passcode, onboarded };
}

boot().then((state) => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App boot={state} />
    </StrictMode>,
  );
});
