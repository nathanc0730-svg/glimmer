import { getSetting, setSetting } from './db.js';
import { isStandalone } from './platform.js';

// Daily reminder via Web Push (iOS 16.4+, Home Screen app only). The reminder server stores ONLY
// the push subscription, a time and a timezone, and sends an empty push once a day. The service
// worker picks the notification text on the phone. No journal content is ever sent.

const PUSH_URL = (import.meta.env.VITE_PUSH_URL ?? '').replace(/\/$/, '');
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

export const pushConfigured = () => !!(PUSH_URL && VAPID_PUBLIC_KEY);

export function pushSupport() {
  if (!pushConfigured()) return { ok: false, reason: 'not-configured' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { ok: false, reason: isStandalone() ? 'unsupported' : 'not-installed' };
  }
  if (!isStandalone()) return { ok: false, reason: 'not-installed' };
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };
  return { ok: true };
}

function keyBytes(b64url) {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob((b64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function post(path, body) {
  const res = await fetch(`${PUSH_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    referrerPolicy: 'no-referrer',
  });
  if (!res.ok) throw new Error(`Reminder server said ${res.status}`);
}

export const defaultTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/**
 * Turns the reminder on (or updates its time). MUST be called directly from a tap:
 * iOS only shows the permission prompt for a user gesture.
 */
export async function enableReminder(time, timezone) {
  // Ask first, before any other await, so iOS still treats it as part of the tap.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications weren’t allowed.');
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  await post('/subscribe', { subscription: sub.toJSON(), time, timezone });
  await setSetting('reminder', { on: true, time, timezone });
}

/** Saves a new time/timezone for an existing subscription (no permission prompt needed). */
export async function updateReminder(time, timezone) {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return enableReminder(time, timezone);
  await post('/subscribe', { subscription: sub.toJSON(), time, timezone });
  await setSetting('reminder', { on: true, time, timezone });
}

export async function disableReminder() {
  const current = await getSetting('reminder', null);
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await post('/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
  } finally {
    await setSetting('reminder', { ...(current ?? {}), on: false });
  }
}

export const TIMEZONES = (() => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [defaultTimezone()];
  }
})();
