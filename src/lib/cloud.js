import { hashKey } from './dates.js';

export const WORD_COLORS = ['#d4c2ff', '#ffc2de', '#b6e2ff', '#ffe3a8', '#c4f1d9', '#ffc7a8'];

/** Word sizes (0..1) scale with frequency; order is shuffled stably so big words mix with small ones. */
export function cloudWords(words, seed) {
  if (!words.length) return [];
  const max = words[0].count;
  const min = words.at(-1).count;
  return words
    .map((w, i) => ({
      ...w,
      size: max === min ? 0.6 : (w.count - min) / (max - min),
      color: WORD_COLORS[i % WORD_COLORS.length],
      order: hashKey(`${seed}:${w.word}`),
    }))
    .sort((a, b) => a.order - b.order);
}
