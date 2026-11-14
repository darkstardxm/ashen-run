# Ashen Run: Game Design Doc (v1, as built)

Approved draft v0.1, updated to match the build. Where the build differs from the draft, this doc follows the build.

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
- **Speed ramp:** starts at 12 m/s and adds 2 m/s every 20 seconds, capped at 30 m/s. Each step fires an ember burst, an FOV kick, camera shake, and a speed-up sting.
- **Patterns:** 18 hand-made rows unlock over time (signature hazards from 6 s, pits from 10 s, multi-lane combos up to 40 s).
- **Collision:** one hit ends the run, with a stagger/fall animation, camera shake, and slow-motion before the game-over screen.

## Scoring
- Distance points tick up continuously.
- **Combo:** each obstacle cleared cleanly (a close dodge, jump, or slide) adds to a combo counter. Each clear is worth 10 points; the multiplier goes x2 at 5, x3 at 15, x5 at 30. A last-moment lane dodge is a near miss worth 25. The combo resets after 4 seconds without a clear.
- **High score** is saved in localStorage and shown on the HUD and the game-over screen, with a "new record" flourish.

## Biomes (v1)
The run cycles through biomes every 1000 m, with an 80 m blend of fog, light, and sky. Later biomes stream in after the game starts. Each has its own palette, lighting, props, and one signature obstacle.
1. **Ashen Cathedral:** broken nave, candles, stained glass, cold blue fog. Signature: swinging censers.
2. **Ember Forge:** lava channels, chains, glowing furnaces, orange light. Signature: floor vents that glow, then blast fire.
3. **Bone Catacombs:** skull walls, low tunnels, green-grey haze. Signature: collapsing ceilings (slide).

## Animation and feel
Run cycle, jump (anticipation, airborne, land squash), slide, lane-change lean, hit or death. Camera bob, FOV kick on speed-up, embers and fog particles, dynamic torch lights (kept cheap for mobile).

## Audio
Heavy industrial metal, Doom-style, synthesized live with the Web Audio API (no audio files). One riff per biome; tempo rises from 132 to 168 BPM and drums gain layers as speed ramps. SFX for jump, land, slide, lane switch, clear, near miss, combo tier, speed-up, hit, game over, new record, biome entry, and each signature hazard. Mute (M key or speaker button) is remembered. Details in /assets/audio/README.md.

## Screens
Loading bar, title (start, high score, mute), HUD (score, combo, multiplier, best, speed), pause, and game over (score, best, new-record flag, restart, back to title). Installable to the home screen (web manifest plus service worker) and playable offline after the first visit.

## Out of scope for v1
Power-ups, collectibles, accounts or online leaderboards, monetization.

## Art pipeline
Art comes from Game Art Director in batches: batch 1 (all models, skies, UI, VFX) for M3 and batch 2 (per-lane pits, runner knee fix, forge rivet fix) for M4. Textures are compressed to WebP with 512 px normal maps to keep the download around 7 MB.

## Milestones
| # | Milestone | What's in it | Done when |
|---|---|---|---|
| M0 | Setup | Repo, README/GDD/CHANGELOG, Vite + Three.js skeleton, Cloudflare Pages hooked to main, runner.massoletti.net live | Blank scene loads at the URL |
| M1 | Core loop (greybox) | Three lanes, jump/slide/lane input (keys plus swipe), procedural obstacles, collision, speed and density ramps, game over and restart | Playable start to finish with placeholders on desktop and mobile |
| M2 | Scoring and persistence | Distance, combo/multiplier, near miss, localStorage high score, HUD, title and pause screens | Score and best persist across reloads |
| M3 | Art and biomes | Art Director batch in, 3 biomes with transitions, fog, embers, lighting, animations | All biomes cycle, holds 60 fps target |
| M4 | Audio and polish | Metal tracks and SFX, camera juice, mobile tuning, bug fixing | Full play-test pass, no open blocking bugs |
| v1 | Release | Final play-test on desktop and mobile at the live URL, docs cleaned up | You sign off |

Status: v1.0 shipped and signed off on Nov 13, 2026.

Each milestone is play-tested in a real browser (frame rate, desktop and mobile input, high-score persistence, restart) before it's called done.
