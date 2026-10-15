// Word and line frequency for Insights and recaps. Runs entirely on-device.
const STOP = new Set(
  `a about above after again against all also am an and any are aren't as at be because been before being below
  between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for
  from further get got had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him
  himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself just let's like lot lots me more
  most much mustn't my myself no nor not now of off on once one only or other ought our ours ourselves out over own
  really same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them
  themselves then there there's these they they'd they'll they're they've thing things this those through to too
  today under until up us very was wasn't we we'd we'll we're we've were weren't what what's when when's where
  where's which while who who's whom why why's will with won't would wouldn't yet you you'd you'll you're you've your
  yours yourself yourselves im ive dont didnt cant got gonna wanna went go going make made day days time even still
  back way well also new first last little big good great many every always never something anything everything
  someone feel felt day's week today's tonight morning came come comes took take put said around getting went`.split(/\s+/),
);

const lineTexts = (entries) => entries.flatMap((e) => e.lines ?? []);

export function tokenize(text) {
  return (text.toLowerCase().replace(/[’‘]/g, "'").match(/[a-zà-ÿ][a-zà-ÿ']*[a-zà-ÿ]/g) ?? []).filter(
    (w) => w.length >= 3 && !STOP.has(w),
  );
}

/** [{ word, count }] most frequent first. */
export function topWords(entries, limit = 30) {
  const counts = new Map();
  for (const line of lineTexts(entries)) {
    for (const w of tokenize(line)) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

const normalizeLine = (l) =>
  l
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Short lines she has written more than once ("my family", "coffee"). [{ text, count }] */
export function topLines(entries, limit = 5) {
  const counts = new Map();
  for (const line of lineTexts(entries)) {
    if (line.length > 60) continue;
    const key = normalizeLine(line);
    if (!key) continue;
    const cur = counts.get(key);
    counts.set(key, { text: line.trim(), count: (cur?.count ?? 0) + 1 });
  }
  return [...counts.values()]
    .filter((x) => x.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
