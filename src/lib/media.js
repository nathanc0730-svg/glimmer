import { db, uid } from './db.js';

export const MAX_MEDIA = 8;
const PHOTO_MAX = 1600;
const THUMB_MAX = 480;
export const VIDEO_WARN_SECONDS = 60;
export const VIDEO_WARN_BYTES = 50 * 1024 * 1024;
const VIDEO_HARD_BYTES = 300 * 1024 * 1024;

const canvasToBlob = (canvas, quality) =>
  new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality),
  );

function drawScaled(source, w, h, max) {
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

const once = (el, event) =>
  new Promise((resolve, reject) => {
    el.addEventListener(event, resolve, { once: true });
    el.addEventListener('error', () => reject(new Error(`${event} failed`)), { once: true });
  });

async function processPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode(); // Safari applies EXIF orientation when drawing an <img>.
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const blob = await canvasToBlob(drawScaled(img, w, h, PHOTO_MAX), 0.8);
    const thumbBlob = await canvasToBlob(drawScaled(img, w, h, THUMB_MAX), 0.75);
    const scale = Math.min(1, PHOTO_MAX / Math.max(w, h));
    return { type: 'image', blob, thumbBlob, width: Math.round(w * scale), height: Math.round(h * scale) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Reads duration/size and grabs a poster frame. A missing poster is fine; the tile falls back. */
export async function inspectVideo(file) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.preload = 'auto';
  video.src = url;
  try {
    await withTimeout(once(video, 'loadedmetadata'), 10000);
    const duration = Number.isFinite(video.duration) ? video.duration : 0; // 0 = unknown
    const info = { duration, width: video.videoWidth, height: video.videoHeight, thumbBlob: null };
    try {
      // iOS won't decode frames until playback has started at least once.
      await video.play().catch(() => {});
      video.pause();
      video.currentTime = duration ? Math.min(0.5, duration / 3) : 0.1;
      await withTimeout(once(video, 'seeked'), 5000);
      if (video.videoWidth) {
        info.thumbBlob = await canvasToBlob(drawScaled(video, video.videoWidth, video.videoHeight, THUMB_MAX), 0.75);
      }
    } catch {
      /* no poster frame; still a valid video */
    }
    return info;
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

export function describeVideo(seconds, bytes) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  const len = mins ? `${mins}m ${secs}s` : `${secs}s`;
  return `${len}, ${Math.round(bytes / 1024 / 1024)} MB`;
}

/**
 * Turns a picked File into a stored media row. `confirmLarge(message)` lets the UI ask before
 * keeping a long/large video. Resolves to the new media id, or null if skipped.
 */
export async function importFile(file, { confirmLarge } = {}) {
  const isVideo = file.type.startsWith('video/') || /\.(mov|mp4|m4v|webm)$/i.test(file.name);
  let row;
  if (isVideo) {
    if (file.size > VIDEO_HARD_BYTES) {
      throw new Error('That video is too large to save on-device. Try trimming it in Photos first.');
    }
    const info = await inspectVideo(file);
    if ((info.duration > VIDEO_WARN_SECONDS || file.size > VIDEO_WARN_BYTES) && confirmLarge) {
      const ok = await confirmLarge(
        `This video is ${describeVideo(info.duration || 0, file.size)}. Big videos use a lot of space on your phone. Add it anyway?`,
      );
      if (!ok) return null;
    }
    // Copy into a fresh Blob so the data is owned by IndexedDB, not the file picker.
    const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'video/mp4' });
    row = { type: 'video', blob, ...info };
  } else {
    row = await processPhoto(file);
  }
  const id = uid();
  await db.media.add({ id, createdAt: Date.now(), ...row });
  return id;
}
