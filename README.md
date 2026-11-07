# Ashen Run

A dark gothic 3D endless runner for the browser, built with Three.js. You run away from the camera through cursed ruins, dodging traps that get faster and denser the longer you survive. Play it at **https://runner.massoletti.net** (coming soon).

## Controls
| Action | Desktop | Mobile |
|---|---|---|
| Jump | Space / Up | Tap / swipe up |
| Slide | Down | Swipe down |
| Lane change | Left / Right | Swipe left / right |
| Pause | Esc / P | Pause button |

## Development
Requires Node 20+.

```bash
npm install
npm run dev      # local dev server
npm run build    # production build into dist/
npm run preview  # serve the build
```

## Deploy
Cloudflare Pages connected to `main`. Build command `npm run build`, output directory `dist`.

## Docs
- [Game Design Doc](docs/GDD.md)
- [Changelog](CHANGELOG.md)
- [Asset licenses](assets/LICENSES.md)

Art lives in `assets/art`, audio in `assets/audio`.
