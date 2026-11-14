# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased
### Removed
- Unused full-width pit models (gap_edge.glb), replaced by per-lane gap_lane.glb.
### Fixed
- iPhone Safari audio: unlocks on more tap events and resumes after calls or app switches. Sound follows the ring/silent switch on purpose (no sound when the phone is on silent).
### Docs and tests
- GDD updated to the as-built game; README covers phone install and testing.
- `npm test` runs every play-test (tests/all.mjs) and prints a pass/fail table.
### Install
- Installable as an app (web manifest plus service worker). Plays offline after the first visit.
### Art batch 2
- Per-lane pit model (gap_lane.glb) for every biome replaces the flat procedural pit; procedural pit stays as a fallback.
- Runner knee pop in the run cycle and death-fall knee dip fixed.
- Ember Forge: doubled rivets and z-fighting fixed (retiled wall, re-exported obstacles and scenery).
### Performance
- Recompressed models (WebP textures, 512 px normal maps), VFX sheets and game-over panel to WebP.
- Ember Forge and Bone Catacombs now stream in after the game starts; only the runner, VFX and Ashen Cathedral block the loading screen.

## [Unreleased]
### Fixed
- Going back to the title after dying left the obstacle that killed you stuck to the runner. The run is now fully cleared on the way back.
- Title instructions got cut off on narrow screens. They now wrap, and phones get touch-only instructions.
### Added
- M4 audio and polish: a procedural industrial metal soundtrack (per-biome riffs, tempo 132 to 168 BPM, layers build with speed) plus a full SFX set for moves, scoring, hazards, hits and game over. Mute button and M key, saved between visits. Audio pauses with the game. Back-to-title button on game over. Soft limiter on the mix, camera nudge on speed-up, and phone vibration on death and combo tier-up.
- M3 art and biomes: art batch 1 integrated (rigged runner with run, lean, jump, land, slide, hit and death clips; per-biome track, scenery, obstacles, skies, VFX and UI). Three biomes (Ashen Cathedral, Ember Forge, Bone Catacombs) with fog, light and sky crossfades and a name banner. Signature hazards: swinging censer, telegraphed fire vent, collapsing ceiling. Loading screen, new fonts and HUD/game-over art. Static scenery is merged per material and the pixel ratio adapts to keep phones smooth.
- M2 scoring: distance points times a combo multiplier (x2 at 5, x3 at 15, x5 at 30), +10 per clean clear, +25 per near miss (late lane dodge), combo drops after 4s without a clear. High score saved in localStorage and shown on title, HUD and game over with a NEW RECORD flag. Pause via Esc/P, an on-screen button, or switching tabs.
- M1 core loop (greybox): three lanes, keyboard and swipe/tap input with input buffering, jump with squash and stretch, slide, procedural obstacle patterns (low barrier, hanging beam, wall, gap), AABB collision, speed ramp every 20s with FOV kick, density ramp, hit sparks, camera shake and slow-mo death, title and game-over screens with restart.
- M0 setup: Vite + Three.js skeleton with a foggy three-lane causeway, placeholder runner, embers, and torch light.
- Docs: README, GDD (docs/GDD.md), CHANGELOG, asset license log.
