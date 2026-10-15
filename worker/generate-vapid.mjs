// Creates the VAPID key pair for Web Push. Run once:  node generate-vapid.mjs
// Public key  -> wrangler.toml VAPID_PUBLIC_KEY  and the app's VITE_VAPID_PUBLIC_KEY
// Private JWK -> npx wrangler secret put VAPID_PRIVATE_JWK  (keep it secret!)
const { subtle } = globalThis.crypto;
const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const raw = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
const b64url = (bytes) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwk = await subtle.exportKey('jwk', pair.privateKey);
console.log('\nVAPID_PUBLIC_KEY (public, safe to share):\n' + b64url(raw));
console.log('\nVAPID_PRIVATE_JWK (secret, paste when wrangler asks):\n' + JSON.stringify(jwk) + '\n');
