import { db } from './db.js';
import { shareFile } from './share.js';
import { WEEKDAY_SHORT, formatShort, monthOf, monthWeeks } from './dates.js';
import { WORD_COLORS, cloudWords } from './cloud.js';

// Draws a recap slide as a 1080×1920 story image, entirely on-device. The image only leaves the
// phone if she picks a destination in the iOS share sheet herself.

const W = 1080;
const H = 1920;
const PAD = 90;
const SERIF = 'ui-serif, "New York", Georgia, serif';
const SANS = '-apple-system, system-ui, "Segoe UI", sans-serif';
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';
const INK = '#1d1530';
const LIGHT = '#f3f2f7';
const MUTED_DARK = 'rgba(243,242,247,0.6)';
const MUTED_INK = 'rgba(29,21,48,0.6)';

async function loadImage(mediaId, full = false) {
  const m = await db.media.get(mediaId);
  if (!m) return null;
  const blob = full && m.type === 'image' ? m.blob : (m.thumbBlob ?? (m.type === 'image' ? m.blob : null));
  if (!blob) return null;
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await img.decode();
  URL.revokeObjectURL(url);
  return img;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx, img, x, y, w, h, r = 0) {
  const iw = img.width;
  const ih = img.height;
  const s = Math.max(w / iw, h / ih);
  const sw = w / s;
  const sh = h / s;
  ctx.save();
  if (r) {
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
  }
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
  ctx.restore();
}

function wrap(ctx, text, maxWidth, maxLines = 99) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[\s,.;:!?]+$/, '')}…`;
  }
  return lines;
}

function text(ctx, str, x, y, { font, color, align = 'left', maxWidth = W - PAD * 2, lineHeight, maxLines } = {}) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  const lines = wrap(ctx, str, maxWidth, maxLines);
  const lh = lineHeight ?? parseInt(font.match(/(\d+)px/)[1], 10) * 1.2;
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return y + lines.length * lh;
}

function background(ctx, kind) {
  if (kind === 'pastel') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#d4c2ff');
    g.addColorStop(0.52, '#ffc7e3');
    g.addColorStop(1, '#bfe6ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  ctx.fillStyle = '#0b0b0e';
  ctx.fillRect(0, 0, W, H);
  const glows =
    kind === 'dusk'
      ? [['rgba(212,194,255,0.35)', W * 0.2, H * 0.15], ['rgba(255,199,227,0.25)', W * 0.9, H * 0.85]]
      : [['rgba(212,194,255,0.22)', W * 0.85, H * 0.1], ['rgba(191,230,255,0.18)', W * 0.1, H * 0.9]];
  for (const [c, x, y] of glows) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, W * 0.9);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function header(ctx, recap, dark) {
  const label = `GLIMMER · ${recap.kind === 'week' ? 'WEEKLY' : 'MONTHLY'} RECAP`;
  text(ctx, label, PAD, 150, { font: `700 30px ${SANS}`, color: dark ? MUTED_DARK : MUTED_INK });
  text(ctx, recap.label, PAD, 205, { font: `600 38px ${SANS}`, color: dark ? LIGHT : INK });
}

function checkCircles(ctx, recap, y, dark) {
  const n = 7;
  const gap = (W - PAD * 2) / n;
  recap.dayKeys.forEach((k, i) => {
    const cx = PAD + gap * i + gap / 2;
    const done = recap.written.has(k);
    ctx.beginPath();
    ctx.arc(cx, y, 52, 0, Math.PI * 2);
    ctx.fillStyle = done ? (dark ? '#d4c2ff' : INK) : dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)';
    ctx.fill();
    if (done) {
      ctx.strokeStyle = dark ? INK : '#fff';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 20, y + 2);
      ctx.lineTo(cx - 5, y + 17);
      ctx.lineTo(cx + 22, y - 14);
      ctx.stroke();
    }
    text(ctx, WEEKDAY_SHORT[i], cx, y + 110, { font: `600 32px ${SANS}`, color: dark ? MUTED_DARK : MUTED_INK, align: 'center' });
  });
}

async function moments(ctx, r) {
  background(ctx, 'dark');
  header(ctx, r, true);
  let y = text(ctx, `Your ${r.noun} in moments`, PAD, 330, { font: `500 88px ${SERIF}`, color: LIGHT, lineHeight: 100 });
  const ids = r.media.slice(0, 6);
  const imgs = (await Promise.all(ids.map((id) => loadImage(id).catch(() => null)))).filter(Boolean);
  if (imgs.length) {
    const cols = imgs.length === 1 ? 1 : imgs.length <= 4 ? 2 : 3;
    const rows = Math.ceil(imgs.length / cols);
    const gap = 20;
    const areaH = r.first ? 760 : 1100;
    const cw = (W - PAD * 2 - gap * (cols - 1)) / cols;
    const ch = Math.min(cw * (imgs.length === 1 ? 1.1 : 1), (areaH - gap * (rows - 1)) / rows);
    y += 30;
    imgs.forEach((img, i) => {
      const cx = PAD + (i % cols) * (cw + gap);
      const cy = y + Math.floor(i / cols) * (ch + gap);
      drawCover(ctx, img, cx, cy, cw, ch, 28);
    });
    y += rows * ch + (rows - 1) * gap + 90;
  } else y += 80;
  if (r.first) {
    y = text(ctx, `You started your ${r.noun} with`, PAD, y, { font: `500 36px ${SANS}`, color: MUTED_DARK }) + 10;
    y = text(ctx, `“${r.first.text}”`, PAD, y + 20, { font: `italic 500 54px ${SERIF}`, color: LIGHT, lineHeight: 66, maxLines: 3 }) + 30;
    if (r.last) {
      y = text(ctx, '…and ended it with', PAD, y, { font: `500 36px ${SANS}`, color: MUTED_DARK }) + 10;
      text(ctx, `“${r.last.text}”`, PAD, y + 20, { font: `italic 500 54px ${SERIF}`, color: LIGHT, lineHeight: 66, maxLines: 3 });
    }
  }
}

function showedUp(ctx, r) {
  background(ctx, 'pastel');
  header(ctx, r, false);
  const days = `${r.daysCount} ${r.daysCount === 1 ? 'day' : 'days'}`;
  let y = text(ctx, `You showed up ${days}`, W / 2, 620, { font: `500 112px ${SERIF}`, color: INK, align: 'center', lineHeight: 124 });
  if (r.kind === 'week') {
    checkCircles(ctx, r, y + 140, false);
    y += 330;
  } else {
    const weeks = monthWeeks(monthOf(r.start));
    const size = 96;
    const gap = 18;
    const x0 = (W - (size * 7 + gap * 6)) / 2;
    weeks.forEach((wk, wi) =>
      wk.forEach((k, di) => {
        if (!k) return;
        ctx.fillStyle = r.written.has(k) ? INK : 'rgba(255,255,255,0.5)';
        roundRect(ctx, x0 + di * (size + gap), y + 60 + wi * (size + gap), size, size, 26);
        ctx.fill();
      }),
    );
    y += 60 + weeks.length * (size + gap) + 80;
  }
  if (r.streak > 0) {
    ctx.font = `700 46px ${SANS}, ${EMOJI}`;
    const label = `🔥 ${r.streak} day streak`;
    const w = ctx.measureText(label).width + 80;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    roundRect(ctx, (W - w) / 2, y, w, 100, 50);
    ctx.fill();
    text(ctx, label, W / 2, y + 66, { font: `700 46px ${SANS}, ${EMOJI}`, color: INK, align: 'center' });
    y += 200;
  }
  text(ctx, 'Consistency over perfection.', W / 2, y + 40, { font: `italic 500 52px ${SERIF}`, color: INK, align: 'center' });
}

function felt(ctx, r) {
  background(ctx, 'dusk');
  header(ctx, r, true);
  let y = text(ctx, `How your ${r.noun} felt`, W / 2, 420, { font: `500 96px ${SERIF}`, color: LIGHT, align: 'center' });
  if (r.kind === 'week') {
    const gap = (W - PAD * 2) / 7;
    r.dayKeys.forEach((k, i) => {
      const cx = PAD + gap * i + gap / 2;
      const m = r.moods[i];
      ctx.beginPath();
      ctx.arc(cx, y + 130, 56, 0, Math.PI * 2);
      ctx.fillStyle = m ? `${m.color}44` : 'rgba(255,255,255,0.08)';
      ctx.fill();
      text(ctx, m ? m.emoji : '·', cx, y + 152, { font: `60px ${EMOJI}, ${SANS}`, color: LIGHT, align: 'center' });
      text(ctx, WEEKDAY_SHORT[i], cx, y + 240, { font: `600 32px ${SANS}`, color: MUTED_DARK, align: 'center' });
    });
    y += 380;
  } else {
    const top = r.moodCounts.slice(0, 5);
    top.forEach(({ mood, count }, i) => {
      const by = y + 80 + i * 120;
      text(ctx, mood.emoji, PAD, by + 52, { font: `64px ${EMOJI}, ${SANS}`, color: LIGHT });
      const maxW = W - PAD * 2 - 220;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      roundRect(ctx, PAD + 110, by + 10, maxW, 56, 28);
      ctx.fill();
      ctx.fillStyle = mood.color;
      roundRect(ctx, PAD + 110, by + 10, Math.max(56, (count / top[0].count) * maxW), 56, 28);
      ctx.fill();
      text(ctx, String(count), W - PAD, by + 52, { font: `700 40px ${SANS}`, color: LIGHT, align: 'right' });
    });
    y += 80 + top.length * 120 + 80;
  }
  if (r.primaryMood) {
    text(ctx, 'Mostly', W / 2, y + 60, { font: `500 40px ${SANS}`, color: MUTED_DARK, align: 'center' });
    text(ctx, r.primaryMood.emoji, W / 2, y + 260, { font: `180px ${EMOJI}, ${SANS}`, color: LIGHT, align: 'center' });
    text(ctx, r.primaryMood.label, W / 2, y + 380, { font: `500 84px ${SERIF}`, color: LIGHT, align: 'center' });
  }
}

function words(ctx, r) {
  background(ctx, 'dark');
  header(ctx, r, true);
  text(ctx, `Your ${r.noun} in words`, W / 2, 420, { font: `500 96px ${SERIF}`, color: LIGHT, align: 'center' });
  const items = cloudWords(r.words, r.id);
  // Greedy centered rows.
  const rows = [];
  let row = [];
  let rowW = 0;
  const maxW = W - PAD * 2;
  for (const w of items) {
    const size = 58 + w.size * 92;
    ctx.font = `500 ${size}px ${SERIF}`;
    const ww = ctx.measureText(w.word).width;
    if (rowW + ww > maxW && row.length) {
      rows.push({ row, rowW });
      row = [];
      rowW = 0;
    }
    row.push({ ...w, px: size, ww });
    rowW += ww + 36;
  }
  if (row.length) rows.push({ row, rowW });
  const heights = rows.map((r2) => Math.max(...r2.row.map((w) => w.px)) * 1.25);
  const total = heights.reduce((a, b) => a + b, 0);
  let y = Math.max(560, 560 + (1200 - total) / 2);
  rows.forEach(({ row: ws, rowW: rw }, i) => {
    let x = (W - (rw - 36)) / 2;
    y += heights[i];
    for (const w of ws) {
      ctx.globalAlpha = 0.65 + w.size * 0.35;
      text(ctx, w.word, x, y - heights[i] * 0.2, { font: `500 ${w.px}px ${SERIF}`, color: w.color ?? WORD_COLORS[0], maxWidth: 9999 });
      x += w.ww + 36;
    }
    ctx.globalAlpha = 1;
  });
  if (!items.length) text(ctx, 'Your words will bloom here.', W / 2, 900, { font: `italic 52px ${SERIF}`, color: MUTED_DARK, align: 'center' });
}

async function highlight(ctx, r) {
  const e = r.highlight;
  const mediaId = e?.mediaIds?.[0];
  const img = mediaId ? await loadImage(mediaId, true).catch(() => null) : null;
  const dark = !!img;
  if (img) {
    drawCover(ctx, img, 0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.35, 'rgba(0,0,0,0)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.2)');
    g.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else background(ctx, 'pastel');
  header(ctx, r, dark);
  if (!e) return;
  const color = dark ? LIGHT : INK;
  // Measure the block so it sits at the bottom.
  ctx.font = `500 76px ${SERIF}`;
  const promptLines = wrap(ctx, e.prompt ?? 'Free write', W - PAD * 2, 3);
  ctx.font = `400 44px ${SANS}`;
  const bodyLines = e.lines.slice(0, 4).flatMap((l) => wrap(ctx, l, W - PAD * 2, 3)).slice(0, 7);
  const blockH = 60 + promptLines.length * 88 + 30 + bodyLines.length * 62;
  let y = img ? H - 140 - blockH : 700;
  y = text(ctx, `A FAVORITE MOMENT · ${formatShort(e.date).toUpperCase()}`, PAD, y, { font: `700 32px ${SANS}`, color: dark ? MUTED_DARK : MUTED_INK }) + 40;
  y = text(ctx, e.prompt ?? 'Free write', PAD, y + 30, { font: `500 76px ${SERIF}`, color, lineHeight: 88, maxLines: 3 }) + 30;
  bodyLines.forEach((l, i) => text(ctx, l, PAD, y + i * 62, { font: `400 44px ${SANS}`, color, maxWidth: 9999 }));
}

const RENDER = { moments, showedUp, felt, words, highlight };

export async function renderSlideImage(recap, type) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  await RENDER[type](ctx, recap);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92));
}

/** Hands the image to the iOS share sheet (Save Image, Messages, …). */
export const shareImage = (blob, name) => shareFile(new File([blob], name, { type: 'image/jpeg' }));
