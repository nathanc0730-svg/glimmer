// Glimmer daily reminder: a tiny Cloudflare Worker.
//
// It stores ONLY: a push endpoint URL, a reminder time ("20:30") and a timezone.
// It sends an EMPTY Web Push once a day; the phone's service worker writes the notification text.
// It never receives, stores or sends any journal content.

const PUSH_HOSTS = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];
const SEND_WINDOW_MIN = 120; // if a run is missed, still send within 2 hours of the chosen time

const json = (data, status, cors) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } });

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

async function keyFor(endpoint) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return `sub:${b64url(digest)}`;
}

export function validEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

export function validTimezone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** { date: 'YYYY-MM-DD', minutes } for "now" in the given timezone. */
export function localNow(timezone, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function isDue(sub, now = new Date()) {
  const { date, minutes } = localNow(sub.timezone, now);
  const [h, m] = sub.time.split(':').map(Number);
  const target = h * 60 + m;
  return sub.lastSent !== date && minutes >= target && minutes - target < SEND_WINDOW_MIN ? date : null;
}

export async function vapidJwt(audience, env) {
  const enc = (obj) => b64url(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: env.VAPID_SUBJECT,
  })}`;
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // WebCrypto returns the raw r||s signature, which is exactly what ES256 JWTs use.
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(sig)}`;
}

async function sendPush(endpoint, env) {
  const jwt = await vapidJwt(new URL(endpoint).origin, env);
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      TTL: '3600',
      Urgency: 'normal',
      'Content-Length': '0',
    },
  });
}

export async function runReminders(env, now = new Date()) {
  let cursor;
  const results = [];
  do {
    const page = await env.SUBS.list({ prefix: 'sub:', cursor });
    for (const { name } of page.keys) {
      const sub = await env.SUBS.get(name, 'json');
      if (!sub) continue;
      const date = isDue(sub, now);
      if (!date) continue;
      const res = await sendPush(sub.endpoint, env);
      if (res.status === 404 || res.status === 410) {
        await env.SUBS.delete(name); // subscription expired or was turned off on the phone
      } else if (res.ok) {
        await env.SUBS.put(name, JSON.stringify({ ...sub, lastSent: date }));
      }
      results.push({ status: res.status });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return results;
}

async function countSubs(env) {
  let n = 0;
  let cursor;
  do {
    const page = await env.SUBS.list({ prefix: 'sub:', cursor });
    n += page.keys.length;
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return n;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = origin && origin === env.ALLOWED_ORIGIN;
    const cors = allowed
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
      : {};
    const { pathname } = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    if (request.method === 'GET' && pathname === '/health') return json({ ok: true }, 200, cors);
    if (request.method !== 'POST') return json({ error: 'not found' }, 404, cors);
    if (!allowed) return json({ error: 'origin not allowed' }, 403, cors);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad json' }, 400, cors);
    }

    if (pathname === '/subscribe') {
      const endpoint = body?.subscription?.endpoint;
      const { time, timezone } = body ?? {};
      if (!validEndpoint(endpoint)) return json({ error: 'bad endpoint' }, 400, cors);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time ?? '')) return json({ error: 'bad time' }, 400, cors);
      if (!validTimezone(timezone)) return json({ error: 'bad timezone' }, 400, cors);
      const key = await keyFor(endpoint);
      const existing = await env.SUBS.get(key, 'json');
      if (!existing && (await countSubs(env)) >= Number(env.MAX_SUBSCRIPTIONS || 5)) {
        return json({ error: 'too many subscriptions' }, 429, cors);
      }
      // Only the endpoint is kept (an empty push needs no encryption keys).
      // If the time changed, allow today's reminder to go out at the new time.
      const lastSent = existing && existing.time === time && existing.timezone === timezone ? existing.lastSent : null;
      await env.SUBS.put(key, JSON.stringify({ endpoint, time, timezone, lastSent }));
      return json({ ok: true }, 200, cors);
    }

    if (pathname === '/unsubscribe') {
      if (!validEndpoint(body?.endpoint)) return json({ error: 'bad endpoint' }, 400, cors);
      await env.SUBS.delete(await keyFor(body.endpoint));
      return json({ ok: true }, 200, cors);
    }

    return json({ error: 'not found' }, 404, cors);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runReminders(env));
  },
};
