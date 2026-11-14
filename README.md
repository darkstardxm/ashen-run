# Ashen Run

A dark gothic 3D endless runner for the browser, built with Three.js. You run away from the camera through cursed ruins, dodging traps that get faster and denser the longer you survive. Play it at **https://runner.massoletti.net**.

## Controls
| Action | Desktop | Mobile |
|---|---|---|
| Jump | Space / Up | Tap / swipe up |
| Slide | Down | Swipe down |
| Lane change | Left / Right | Swipe left / right |
| Pause | Esc / P | Pause button |
| Mute | M | Speaker button |

## Scoring
Distance earns points times your combo multiplier. Jumping, sliding, or dodging past an obstacle builds the combo (x2 at 5, x3 at 15, x5 at 30). A last-moment lane dodge is a near miss worth extra. Go 4 seconds without clearing anything and the combo resets. Your best score is saved in the browser.

## Biomes
The run cycles through three biomes, 1000 m each, with an 80 m blend of fog, light, and sky between them.
- **Ashen Cathedral**: cold blue fog, gothic arches, and swinging censers you have to dodge.
- **Ember Forge**: orange haze, embers, and floor vents that glow before they blast fire.
- **Bone Catacombs**: green-grey murk, crypt arches, and ceilings that shake, then collapse into rubble.

Every biome also has low barriers (jump), hanging beams (slide), broken walls (change lanes), and pits (jump).

## Audio
Heavy industrial metal, synthesized live in the browser with no audio files. The tempo and drum layers build as you speed up, and each biome has its own riff. Press M or tap the speaker to mute. See [assets/audio/README.md](assets/audio/README.md).

## Development
Requires Node 20+.

```bash
npm install
npm run dev      # local dev server
npm run build    # production build into dist/
npm run preview  # serve the build
```

Play-tests live in `tests/` and use puppeteer-core with a local Chrome. Run all of them against a build with `npm run build && npm run preview` in one terminal and `npm test` in another. See [tests/README.md](tests/README.md).

## Install on a phone
Open the site, then use Add to Home Screen (iOS Safari share menu, or the Android Chrome install prompt). After the first visit it plays offline.

## Deploy
Cloudflare Pages connected to `main`. Build command `npm run build`, output directory `dist`.

## Docs
- [Game Design Doc](docs/GDD.md)
- [Changelog](CHANGELOG.md)
- [Asset licenses](assets/LICENSES.md)

Art lives in `assets/art`, audio in `assets/audio`.
