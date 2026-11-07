# Runner: Game Design Doc (draft v0.1)

Working title: **Ashen Run** (placeholder, open to change)

## Pitch
A 3D endless runner through cursed gothic ruins. You flee down a crumbling causeway, away from the camera, jumping, sliding, and switching lanes past traps that get denser and faster the longer you live. Think Temple Run's controls with a Dark Souls / Doom mood: fog, embers, grim light, heavy industrial metal.

## Platform and tech
- Three.js (WebGL), plain JS modules, bundled with Vite.
- Runs in desktop and mobile browsers. Target 60 fps on a mid-range laptop and a recent phone.
- Hosted on Cloudflare Pages at runner.massoletti.net (free tier).

## Controls
| Action | Desktop | Mobile |
|---|---|---|
| Jump | Space or Up arrow | Tap or swipe up |
| Slide | Down arrow | Swipe down |
| Lane change | Left / Right arrows | Swipe left / right |
| Pause | Esc or P | Pause button |

Three lanes. Short input buffering so a press just before landing still counts.

## Core loop
Run, dodge, score, die, restart in about one second.

- **Obstacles** (procedural, from hand-made chunk patterns): low barriers (jump), hanging blades or beams (slide), broken walls blocking a lane (switch lanes), gaps in the causeway (jump), and combos of these.
- **Density ramp:** spacing between obstacles shrinks and multi-lane patterns get more common over time.
- **Speed ramp:** speed steps up every ~20 seconds up to a cap, with a short visual and audio cue (ember burst plus a riff).
- **Collision:** one hit ends the run, with a stagger/fall animation, camera shake, and slow-motion before the game-over screen.

## Scoring
- Distance points tick up continuously.
- **Combo:** each obstacle cleared cleanly (a close dodge, jump, or slide) adds to a combo counter. The multiplier goes x1 to x2 to x3 to x5 at set thresholds. Getting close to a hit without touching it gives a "near miss" bonus. The combo decays if you go a few seconds without clearing anything.
- **High score** is saved in localStorage and shown on the HUD and the game-over screen, with a "new record" flourish.

## Biomes (v1)
The run cycles through biomes every ~1000 m, with a fog transition between them. Each has its own palette, lighting, props, and one signature obstacle.
1. **Ashen Cathedral:** broken nave, candles, stained glass, cold blue fog. Signature: swinging censers.
2. **Ember Forge:** lava channels, chains, glowing furnaces, orange light. Signature: fire jets.
3. **Bone Catacombs:** skull walls, low tunnels, green-grey haze. Signature: collapsing ceilings (slide).

## Animation and feel
Run cycle, jump (anticipation, airborne, land squash), slide, lane-change lean, hit or death. Camera bob, FOV kick on speed-up, embers and fog particles, dynamic torch lights (kept cheap for mobile).

## Audio
Heavy industrial metal, Doom-style. A looping music track per biome, or one track with layers that intensify with speed. SFX for jump, land, slide, lane switch, combo tier-up, near miss, hit, and game over. Everything generated or properly licensed, recorded in /assets/audio and /assets/LICENSES.md.

## Screens
Title (start, high score, mute), HUD (score, combo, multiplier, best), pause, and game over (score, best, new-record flag, restart, back to title).

## Out of scope for v1
Power-ups, collectibles, accounts or online leaderboards, monetization.

## Art pipeline
Art comes from Game Art Director in one batch per milestone (low-poly models/textures, UI, VFX sprites). Code goes ahead with placeholder geometry in the meantime.

## Milestones
| # | Milestone | What's in it | Done when |
|---|---|---|---|
| M0 | Setup | Repo, README/GDD/CHANGELOG, Vite + Three.js skeleton, Cloudflare Pages hooked to main, runner.massoletti.net live | Blank scene loads at the URL |
| M1 | Core loop (greybox) | Three lanes, jump/slide/lane input (keys plus swipe), procedural obstacles, collision, speed and density ramps, game over and restart | Playable start to finish with placeholders on desktop and mobile |
| M2 | Scoring and persistence | Distance, combo/multiplier, near miss, localStorage high score, HUD, title and pause screens | Score and best persist across reloads |
| M3 | Art and biomes | Art Director batch in, 3 biomes with transitions, fog, embers, lighting, animations | All biomes cycle, holds 60 fps target |
| M4 | Audio and polish | Metal tracks and SFX, camera juice, mobile tuning, bug fixing | Full play-test pass, no open blocking bugs |
| v1 | Release | Final play-test on desktop and mobile at the live URL, docs cleaned up | You sign off |

Each milestone is play-tested in a real browser (frame rate, desktop and mobile input, high-score persistence, restart) before it's called done.
