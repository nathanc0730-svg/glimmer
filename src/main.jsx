import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary, { isLostDatabase, recoverByReload } from './components/ErrorBoundary.jsx';
import { db, getSetting, syncSeedPrompts } from './lib/db.js';
import './styles.css';

// Ask iOS to treat this storage as persistent so the journal isn't evicted.
try {
  navigator.storage?.persist?.().catch(() => {});
} catch {
  /* not supported */
}

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

// Errors outside of drawing (a tap handler, a background save). A lost database connection is fixed
// by reloading; anything else is shown on screen so it can be reported, instead of failing silently.
function showFatal(err) {
  if (isLostDatabase(err) && recoverByReload()) return;
  if (document.getElementById('fatal')) return;
  const box = document.createElement('div');
  box.id = 'fatal';
  box.className = 'fatal-banner';
  box.innerHTML = '<span></span><button type="button">Reload</button>';
  box.querySelector('span').textContent = `Something went wrong: ${String(err?.message || err).slice(0, 160)}`;
  box.querySelector('button').onclick = () => window.location.reload();
  document.body.appendChild(box);
}
window.addEventListener('error', (e) => showFatal(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => showFatal(e.reason));

// iOS can close the database while the app sits in the background. When she comes back, make sure
// it still answers; if not, reload so it reconnects (her entries are untouched).
db.on('close', () => {
  if (document.visibilityState === 'visible') recoverByReload();
});
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Database not responding')), 4000));
  try {
    await Promise.race([db.settings.get('onboarded'), timeout]);
  } catch (err) {
    console.error(err);
    recoverByReload();
  }
});

// iOS sometimes reports a Home Screen app's window as shorter than the screen, leaving the tab bar
// floating too high with an empty band below it. Measure the missing height and stretch past it.
function fitScreen() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const landscape = window.innerWidth > window.innerHeight;
  const screenH = landscape ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
  const gap = standalone ? Math.max(0, Math.min(80, screenH - window.innerHeight)) : 0;
  document.documentElement.style.setProperty('--vh-gap', `${gap}px`);
}
fitScreen();
window.addEventListener('resize', fitScreen);
window.addEventListener('orientationchange', () => setTimeout(fitScreen, 300));

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
      <ErrorBoundary>
        <App boot={state} />
      </ErrorBoundary>
    </StrictMode>,
  );
});
