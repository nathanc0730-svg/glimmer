import { AFFIRMATIONS } from '../data/affirmations.js';
import { hashKey, todayKey } from './dates.js';

export function dailyPrompt(prompts, key = todayKey()) {
  if (!prompts?.length) return null;
  const sorted = [...prompts].sort((a, b) => (a.id < b.id ? -1 : 1));
  return sorted[hashKey(`prompt:${key}`) % sorted.length];
}

export function dailyAffirmationIndex(key = todayKey()) {
  return hashKey(`affirm:${key}`) % AFFIRMATIONS.length;
}
