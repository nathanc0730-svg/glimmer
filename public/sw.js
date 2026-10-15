// Glimmer service worker: offline cache of the app's own files, plus the daily reminder
// notification. Journal data lives in IndexedDB; the only thing read here is the prompt list,
// to pick today's prompt for the notification. Nothing is ever sent anywhere.
const CACHE = 'glimmer-v2';
// Bundles load with crossorigin (an Origin header); ignore Vary so they still match offline.
const MATCH = { ignoreVary: true };
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png'];

// Precache every built bundle (listed by the build in asset-list.json), so even the
// rarely used chunks work offline.
async function cacheAssets(cache) {
  try {
    const res = await fetch('./asset-list.json', { cache: 'no-store' });
    if (!res.ok) return;
    const files = await res.json();
    const missing = [];
    for (const f of files) if (!(await cache.match(`./${f}`, MATCH))) missing.push(`./${f}`);
    await cache.addAll(missing);
  } catch {
    /* offline or dev server: the runtime cache below still fills in */
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      await cacheAssets(cache);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/asset-list.json')) return;

  if (request.mode === 'navigate') {
    // Serve the cached app instantly; refresh it (and any new bundles) in the background.
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match('./index.html', MATCH);
        const network = fetch(request)
          .then(async (res) => {
            if (res.ok) {
              await cache.put('./index.html', res.clone());
              await cacheAssets(cache);
            }
            return res;
          })
          .catch(() => null);
        if (cached) {
          event.waitUntil(network);
          return cached;
        }
        return (await network) || new Response('Offline', { status: 503 });
      })(),
    );
    return;
  }

  // Hashed bundles and icons: cache first, then network.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request, MATCH);
      if (cached) return cached;
      try {
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      } catch {
        return Response.error();
      }
    })(),
  );
});

// ---------- Daily reminder ----------

// Same "today's prompt" choice as the app (src/lib/daily.js).
function hashKey(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
const pad = (n) => String(n).padStart(2, '0');
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function readStore(name) {
  return new Promise((resolve) => {
    const open = indexedDB.open('glimmer');
    open.onerror = () => resolve(null);
    open.onsuccess = () => {
      const db = open.result;
      try {
        const req = db.transaction(name, 'readonly').objectStore(name).getAll();
        req.onsuccess = () => {
          resolve(req.result);
          db.close();
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    };
  });
}

async function reminderText() {
  const fallback = { title: 'Time to journal ✨', body: 'A quiet minute for your heart. What are you grateful for today?' };
  try {
    const settings = await readStore('settings');
    const daily = settings?.find((s) => s.key === 'dailyPrompt');
    if (daily && daily.value === false) return fallback;
    const prompts = await readStore('prompts');
    if (!prompts?.length) return fallback;
    const sorted = prompts.sort((a, b) => (a.id < b.id ? -1 : 1));
    const p = sorted[hashKey(`prompt:${todayKey()}`) % sorted.length];
    return { title: 'Time to journal ✨', body: p.text };
  } catch {
    return fallback;
  }
}

self.addEventListener('push', (event) => {
  // The reminder server sends an empty push; the text is chosen here, on the phone.
  event.waitUntil(
    reminderText().then(({ title, body }) =>
      self.registration.showNotification(title, {
        body,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: 'daily-reminder',
      }),
    ),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (all.length) return all[0].focus();
      return self.clients.openWindow('./');
    })(),
  );
});
