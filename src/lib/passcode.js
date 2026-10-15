import { getSetting, setSetting, db } from './db.js';

// Only a salted PBKDF2 hash of the 4-digit code is stored. This keeps casual eyes out; it does
// not encrypt the journal (a web app can't use Face ID or the Secure Enclave).
const ITERATIONS = 150000;

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(code, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return toB64(bits);
}

export const hasPasscode = async () => !!(await getSetting('passcode', null));

export async function setPasscode(code) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(code, salt, ITERATIONS);
  await setSetting('passcode', { salt: toB64(salt), hash, iterations: ITERATIONS });
}

export async function checkPasscode(code) {
  const stored = await getSetting('passcode', null);
  if (!stored) return true;
  return (await derive(code, fromB64(stored.salt), stored.iterations)) === stored.hash;
}

export const clearPasscode = () => db.settings.delete('passcode');
