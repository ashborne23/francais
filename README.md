# Cahier de français — A1 to B2

A self-contained French study system: 26-unit curriculum from A1 to B2, 73 grammar drills,
448 glossed vocabulary cards with spaced repetition, a 5,000-word frequency audit,
graded film and music recommendations, and CEFR level estimation from hours plus accuracy.

## Hosting on GitHub Pages

1. Upload every file in this folder to the repository root.
2. Settings → Pages → Source: "Deploy from a branch" → Branch: `main`, folder: `/ (root)` → Save.
3. Wait about a minute, then open `https://<your-username>.github.io/<repo-name>/`.

## On an iPad

Open the URL in Safari → Share → Add to Home Screen. It then launches full-screen
with its own icon and works offline (a service worker caches the app).

## Data

Everything is stored in your browser's local storage on the device you use.
It does not sync between devices on its own — use **Export backup** and
**Import backup** at the bottom of the page to move data across.

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire application — markup, styles, data and logic |
| `manifest.webmanifest` | Home-screen name, icon and full-screen behaviour |
| `sw.js` | Service worker for offline use |
| `icon-*.png`, `apple-touch-icon.png` | Home-screen icons |

## Sources

Frequency rankings come from the open-source **wordfreq** dataset (mixed written and
spoken corpora), cross-referenced against an **OpenSubtitles** frequency list (CC BY-SA)
to derive the spoken/written register tags. Vocabulary glosses and example sentences,
grammar drills and curriculum are original to this project.
