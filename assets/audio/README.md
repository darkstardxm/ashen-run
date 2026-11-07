# Audio

Ashen Run has no audio files. All music and sound effects are synthesized live in the browser by `src/audio.js` using the Web Audio API, so there are no samples and nothing third-party is involved.

- **Music:** heavy industrial metal. A 16th-note sequencer drives kick, snare, hats, anvil hits, a distorted two-saw guitar through a waveshaper amp and cab filters, a bass double, and a low drone. Each biome has its own key and riff (Cathedral in D, Forge in C, Catacombs in B). Tempo climbs from 132 to 168 BPM, and drum layers stack up as the run speeds up, ending in double bass at top speed.
- **SFX:** jump, land, slide, lane change, clear, near miss, combo tier-up, speed-up stab, hit, game over, new record, biome gong, and hazard sounds (censer chime, fire vent roar, ceiling rumble and crash).
- **Controls:** mute with the speaker button or M. The setting is saved in `localStorage` (`ashenrun.muted`). Audio pauses with the game.
