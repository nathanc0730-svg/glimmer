import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { getSetting, syncSeedPrompts } from './lib/db.js';
import './styles.css';

// Ask iOS to treat this storage as persistent so the journal isn't evicted.
navigator.storage?.persist?.().catch(() => {});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
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
