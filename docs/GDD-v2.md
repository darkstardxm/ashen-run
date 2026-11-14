# Ashen Run: v2 Design Doc (draft for approval)

v2 builds on the signed-off v1 (docs/GDD.md). Everything in v1 stays; this doc covers only what's new.

## 1. Souls and the unlock shop
- **Souls** float over lanes in short lines and arcs (on the ground, over low barriers to reward jumps, under beams for slides). Run through one to collect it. They glow and drift toward you when you're close.
- Souls are saved in localStorage next to the high score. They also add a small score bonus, so they don't replace combo scoring.
- **Shop** on the title screen (new button). Everything is cosmetic or a mild head start, no pay-to-win and no real money:
  - Runner skins: 4 to 6 (e.g. Ashen Knight default, Ember Warden, Bone Pilgrim, Hollow King).
  - Trails: ember, soulfire, ash.
  - One consumable: "Second Wind" (revive once per run, bought with souls, used from the game-over screen).
- Prices tuned so the first unlock takes about 3 to 5 good runs.

## 2. The Pursuer (chasing boss)
- A huge beast (a hulking hound or armoured wraith, art to pick) chases you from behind the camera.
- It roars in at the start of every run, then falls back out of view.
- **Stumble:** clipping the edge of an obstacle (a glancing side hit, not a head-on hit) or landing badly now makes you stumble instead of dying. The Pursuer closes in and stays visible behind you for about 8 seconds.
- Stumble again while it's close and it catches you: run over with its own death animation.
- Head-on hits still end the run right away, like v1.
- Audio: its own roar, footfall thuds that shake the camera, and the music gets heavier while it's close.

## 3. World: real walls and floor at the sides
- The causeway gets ground on both sides (broken flagstones, rubble, lava or bone beds per biome) and side walls or ruined facades, so windows, candles and statues sit on or in something.
- Each biome gets a modular side kit that tiles every 12 m segment: floor strip, wall piece, a wall with a window or alcove, a wall with a gap or ruin, and corner or buttress trims. Props attach to sockets on the kit.
- Distance: walls stay out of the way of the camera and lane changes (at about x = ±6 to ±8 m).

## 4. Higher-quality art, one large batch
- All three biomes get upgraded models and textures (more detail, better silhouettes and materials), plus the new side kits, the Pursuer, souls, skins, trails and shop UI.
- Same conventions as batches 1 to 3 (glb, metres, -Z forward, WebP textures, colliders in extras), with a per-file size budget so phones stay fast.

## Milestones
| # | Milestone | What's in it | Done when |
|---|---|---|---|
| V2-M1 | Side walls and floor | Side kit loader with placeholders, props anchored to sockets | Props never float; 3 biomes look closed in |
| V2-M2 | Souls | Spawning patterns, collect, magnet drift, save, HUD counter | Souls persist across reloads |
| V2-M3 | Shop | Shop screen, skins, trails, Second Wind | Purchases persist; equipped skin shows in game |
| V2-M4 | Pursuer | Stumble mechanic, chase states, catch death, audio | Two stumbles in 8 s ends the run |
| V2-M5 | Art batch 4 | Integrate the big art batch, perf pass on phone | Download and frame rate stay in budget |
| v2 | Release | Full play-test live, docs updated | You sign off |

Each milestone gets a headless scripted play-test that warps straight to what it covers.

## Out of scope for v2
Power-ups, online leaderboards, daily challenges, real-money purchases.
