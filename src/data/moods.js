// One mood per day. `tone` groups moods for Insights (bright / calm / heavy); colors are soft pastels.
export const MOODS = [
  { id: 'loved', label: 'Loved', emoji: '🥰', tone: 'bright', color: '#ffb8d9' },
  { id: 'excited', label: 'Excited', emoji: '🤩', tone: 'bright', color: '#ffd59e' },
  { id: 'calm', label: 'Calm', emoji: '😌', tone: 'calm', color: '#b6e2ff' },
  { id: 'grateful', label: 'Grateful', emoji: '🙏', tone: 'bright', color: '#d4c2ff' },
  { id: 'confident', label: 'Confident', emoji: '😎', tone: 'bright', color: '#ffc7a8' },
  { id: 'happy', label: 'Happy', emoji: '😊', tone: 'bright', color: '#fff0a0' },
  { id: 'tired', label: 'Tired', emoji: '😴', tone: 'calm', color: '#c3c6dd' },
  { id: 'relieved', label: 'Relieved', emoji: '😮‍💨', tone: 'calm', color: '#c4f1d9' },
  { id: 'thoughtful', label: 'Thoughtful', emoji: '🤔', tone: 'calm', color: '#cfd8ff' },
  { id: 'meh', label: 'Meh', emoji: '😐', tone: 'calm', color: '#bdbdc6' },
  { id: 'anxious', label: 'Anxious', emoji: '😰', tone: 'heavy', color: '#a9c7e8' },
  { id: 'frustrated', label: 'Frustrated', emoji: '😤', tone: 'heavy', color: '#f2a7a0' },
  { id: 'sad', label: 'Sad', emoji: '😢', tone: 'heavy', color: '#9fb4e0' },
  { id: 'down', label: 'Down', emoji: '😔', tone: 'heavy', color: '#a8a3c9' },
  { id: 'sick', label: 'Sick', emoji: '🤒', tone: 'heavy', color: '#b9d9a8' },
];

const BY_ID = Object.fromEntries(MOODS.map((m) => [m.id, m]));
export const moodById = (id) => (id ? (BY_ID[id] ?? null) : null);
