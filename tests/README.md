# Play-tests

Headless Chrome play-tests using puppeteer-core and a local Chrome at `/usr/bin/google-chrome` (set `CHROME` to override).
They drive the game through the `window.__runner` test hook, and jump straight to the stage under test with `warp(distance)` and god mode.

```bash
PUPPETEER_SKIP_DOWNLOAD=1 npm i -D puppeteer-core
npm run build && npm run preview          # serves dist on :4173
npm test                                   # runs every test below, prints a pass/fail table
node tests/all.mjs https://runner.massoletti.net out/   # same, against the live site
```

| Test | Covers |
|---|---|
| `m1.mjs` | Core loop: lanes, jump, slide, death, restart; desktop keys and iPhone touch |
| `m2.mjs` | Scoring, combo, high score persistence, pause |
| `m3.mjs` | All three biomes, signature hazards, a 60 s bot run, mobile input |
| `m4.mjs` | Audio: music per biome, SFX, mute, mix peak (records a short clip) |
| `home.mjs` | Back to title clears obstacles (issue #6) |
| `gapshot.mjs` | Per-lane pit renders in every biome (screenshots) |
| `pwa.mjs` | Manifest, installability, offline reload |

Frame rates from headless Chrome use software rendering and are lower than on real devices.
