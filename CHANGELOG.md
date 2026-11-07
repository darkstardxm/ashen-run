# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]
### Added
- M3 art and biomes: art batch 1 integrated (rigged runner with run, lean, jump, land, slide, hit and death clips; per-biome track, scenery, obstacles, skies, VFX and UI). Three biomes (Ashen Cathedral, Ember Forge, Bone Catacombs) with fog, light and sky crossfades and a name banner. Signature hazards: swinging censer, telegraphed fire vent, collapsing ceiling. Loading screen, new fonts and HUD/game-over art. Static scenery is merged per material and the pixel ratio adapts to keep phones smooth.
- M2 scoring: distance points times a combo multiplier (x2 at 5, x3 at 15, x5 at 30), +10 per clean clear, +25 per near miss (late lane dodge), combo drops after 4s without a clear. High score saved in localStorage and shown on title, HUD and game over with a NEW RECORD flag. Pause via Esc/P, an on-screen button, or switching tabs.
- M1 core loop (greybox): three lanes, keyboard and swipe/tap input with input buffering, jump with squash and stretch, slide, procedural obstacle patterns (low barrier, hanging beam, wall, gap), AABB collision, speed ramp every 20s with FOV kick, density ramp, hit sparks, camera shake and slow-mo death, title and game-over screens with restart.
- M0 setup: Vite + Three.js skeleton with a foggy three-lane causeway, placeholder runner, embers, and torch light.
- Docs: README, GDD (docs/GDD.md), CHANGELOG, asset license log.
