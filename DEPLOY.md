# Deploying Glimmer

This takes about 20 minutes: 10 for the app, 10 for the optional reminder service.

> **Pick the URL once and keep it forever.** iPhone stores her journal per web address. If the app
> later moves to a different URL, the new copy starts empty (she'd need to restore a backup).

---

## 1. Put the code on GitHub

1. Create a free GitHub account if you don't have one, then make a **new repository** named
   `glimmer`. Public is fine: the repo only holds app code, never her journal.
2. From this folder:

```bash
git init
git add .
git commit -m "Glimmer journal"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/glimmer.git
git push -u origin main
```

## 2. Turn on GitHub Pages

1. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Open the **Actions** tab. The "Deploy to GitHub Pages" run takes about a minute.
3. Your app is live at **`https://YOUR-USERNAME.github.io/glimmer/`**.

The app works fully at this point, offline included. Without step 3, Settings shows how to set a
daily reminder in the iPhone Reminders app instead of push notifications.

**Current setup:** live at <https://nathanc0730-svg.github.io/glimmer/>, deployed from
`nathanc0730-svg/glimmer`. Step 3 (push reminders) was skipped in favor of the Reminders app.

## 3. Daily reminder service (optional)

iPhone web apps can receive notifications (iOS 16.4+), but something has to send them on a schedule.
The `worker/` folder is a tiny free Cloudflare Worker that does only this.

**It stores:** a push address issued by Apple, the reminder time, and the timezone.
**It never sees:** entries, prompts, moods, photos, or anything else she writes. It sends an *empty*
push, and her phone picks the notification text itself.

1. Create a free account at <https://dash.cloudflare.com/sign-up>.
2. Log in and create the storage:

```bash
cd worker
npx wrangler login
npx wrangler kv namespace create SUBS
```

   Copy the printed `id` into `worker/wrangler.toml` (replace `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`).

3. Generate the push keys:

```bash
node generate-vapid.mjs
```

4. Edit `worker/wrangler.toml`:
   - `VAPID_PUBLIC_KEY`: the public key printed above
   - `ALLOWED_ORIGIN`: `https://YOUR-USERNAME.github.io` (origin only, no `/glimmer` path)
   - `VAPID_SUBJECT`: `mailto:` plus your email (Apple requires a contact)
5. Store the private key as a secret. Paste the whole `{...}` JSON when asked:

```bash
npx wrangler secret put VAPID_PRIVATE_JWK
```

6. Deploy:

```bash
npx wrangler deploy
```

   Note the URL it prints, e.g. `https://glimmer-reminder.yourname.workers.dev`. Opening
   `…/health` in a browser should show `{"ok":true}`.

7. Tell the app where the worker is. In GitHub: **Settings → Secrets and variables → Actions →
   Variables → New repository variable**, and add both:
   - `VITE_PUSH_URL` = the worker URL from step 6
   - `VITE_VAPID_PUBLIC_KEY` = the public key from step 3
8. Rebuild: **Actions → Deploy to GitHub Pages → Run workflow**.

To check what the worker holds at any time: `npx wrangler kv key list --binding SUBS --remote`.
You'll see one key per subscribed phone, and nothing else.

## 4. Installing it on her iPhone

1. Open **Safari** and go to `https://YOUR-USERNAME.github.io/glimmer/`.
   (Glimmer shows these same steps if it's opened in a Safari tab.)
2. Tap the **Share** button (square with an arrow) → scroll down → **Add to Home Screen** → **Add**.
3. Close Safari and open **Glimmer from the Home Screen icon**. Always use the icon. The journal
   lives inside the Home Screen app, separate from Safari.
4. Tap **Let's begin** on the welcome screen.
5. Daily reminder: in the **Reminders** app, add "Journal in Glimmer ✨" → ⓘ → Date + Time →
   **Repeat: Daily**. (If you set up step 3, use **Settings → Daily reminder** in Glimmer instead.)
6. Optional: **Settings → Passcode lock**.
7. Optional but wise: **Settings → Export backup → Save backup → Save to Files → iCloud Drive**.
   Glimmer gently reminds her if two weeks pass without a backup.

### Other reminder options

Besides the Reminders app, an iPhone Shortcuts automation also works:

1. **Shortcuts** app → **Automation** → **+**
2. **Time of Day** → choose the time → **Daily** → **Run Immediately** → **Next**
3. Add the action **Show Notification**, text: `Time to journal ✨` → **Done**

When it buzzes, she opens Glimmer from the Home Screen. Don't use an "Open URLs" action: it opens
Safari, which has a separate, empty copy of the journal.

## Updating the app later

Change the code, then `git push`. GitHub rebuilds automatically. The app picks up the new version in
the background, and she sees it the next time she opens it. Her entries are untouched by updates.

## Moving to a new phone

Export a backup to iCloud Drive on the old phone. Install Glimmer on the new phone (step 4), then
**Settings → Import backup** and pick the `.zip`.

## Troubleshooting

- **No reminder:** needs iOS 16.4+, opened from the Home Screen, notifications allowed
  (iPhone Settings → Notifications → Glimmer), and no Focus mode silencing it. Turning the reminder
  off and on again in Glimmer re-registers it.
- **No "Add to Home Screen":** use Safari (on iOS 16.4+ it's also in Chrome's share menu).
- **Netlify or Vercel instead of GitHub Pages:** run `npm run build` and deploy the `dist/` folder
  (Netlify Drop works by drag-and-drop). Set `ALLOWED_ORIGIN` in the worker to that site's origin,
  and the two `VITE_` values as that host's build environment variables.

## Privacy, in one paragraph

No accounts, analytics, trackers or third-party fonts. Entries, moods, photos and videos are stored
in IndexedDB on her iPhone. The only network traffic is loading app updates from your static host
and, if enabled, registering for the daily reminder (push address + time + timezone). Recap images
and backups leave the phone only through the iOS share sheet, when she chooses a destination.
