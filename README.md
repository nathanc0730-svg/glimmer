# Glimmer

A private, offline-first gratitude journal (PWA). No accounts, no analytics. Every entry, photo and
video is stored on the phone in IndexedDB and never leaves it.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173 (and your LAN IP for testing on the phone)
npm run build      # static files in dist/
npm run preview    # serve the production build (service worker active)
npm run icons      # regenerate icons + iOS splash screens in public/icons
```

## Structure

- `src/lib/db.js`: Dexie schema (entries, media, days, prompts, settings)
- `src/lib/media.js`: photo resize (1600px JPEG 0.8), video poster frames and size/length warnings
- `src/components/PromptPicker.jsx`: the "+" sheet (categories, search, surprise, favorites, custom)
- `src/components/EntryEditor.jsx`: date backfill, lines/paragraph, photos/videos (max 8)
- `src/screens/Home.jsx`: today card, daily affirmation, recent entries by date
- `src/components/MoodSheet.jsx`: one mood per day (asked after the day's first entry)
- `src/screens/Memories.jsx`: day grid, All/Saved, search, flashbacks, calendar
- `src/screens/Insights.jsx`: stats, mood calendar, frequent words and lines, recap lists
- `src/lib/recap.js` + `src/components/RecapViewer.jsx`: weekly/monthly story recaps, built locally
- `src/lib/shareImage.js`: draws a recap slide as a 1080×1920 JPEG for the iOS share sheet
- `src/lib/backup.js`: .zip export/import (journal.json + media files), backup reminder
- `src/lib/passcode.js`, `src/components/LockScreen.jsx`: optional 4-digit lock (salted PBKDF2 hash only)
- `src/lib/push.js` + `worker/`: optional daily reminder via Web Push (worker never sees journal data)
- `public/sw.js`: offline cache of the app, plus the reminder notification

Built with Vite + Preact (via `preact/compat`, so the code is plain React) to keep the main bundle around 75 KB gzipped (the backup zipper loads only when used).

Deploy, reminder setup and iPhone install steps: see [DEPLOY.md](DEPLOY.md).
