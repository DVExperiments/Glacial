# Glacial: the world's slowest race

Two pixels race across a 1,024 px screen. It takes them about a day.

- **Daily Crawl**: a new two-pixel race every day at 00:00 UTC, lasting roughly 22 to 23½ hours.
- **Grand Prix**: on the 1st of every month, the eight highest-rated pixels race 1,920 px over about 46 hours.
- **Standings, pixel profiles, archive with time-lapse replays, and records.**

There is no server and no database. Every race is generated deterministically from its date, so every visitor sees the same race at the same moment, and the browser rebuilds the full history (ratings, stats, records) on each visit.

## Publish on GitHub Pages

1. Create a new repository on GitHub (for example `glacial`).
2. Upload the contents of this folder to the root of the repository (so `index.html` is at the top level, not inside a subfolder).
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose the `main` branch and the `/ (root)` folder, then save.
5. After a minute the site is live at `https://<your-username>.github.io/<repository-name>/`.

## Run locally

Open `index.html` in a browser. No build step, no dependencies.

## Files

| File | What it does |
| --- | --- |
| `js/pixels.js` | The sixteen pixels, their colours, bios and temperaments |
| `js/sim.js` | The deterministic race simulator |
| `js/league.js` | Schedule, ratings, statistics and records |
| `js/words.js` | Formatting and race commentary |
| `js/draw.js` | The track, close-up and charts |
| `js/views.js` | Every page |
| `js/app.js` | Routing and the live update loop |

## Tweaking

- Add or change pixels in `js/pixels.js`. Changing the roster, traits or the simulator changes the whole history, since everything is replayed from `G.EPOCH` in `js/league.js`.
- `G.EPOCH` sets the date of the very first race.
