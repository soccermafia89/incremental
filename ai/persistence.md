# Persistence (save / load)

Lives in `src/core/persistence/`.

| File | Role |
| --- | --- |
| `GameSnapshot.ts` | Plain-data mirror, plus `SAVE_FORMAT_VERSION` |
| `GameSerializer.ts` | `Game` → snapshot |
| `GameDeserializer.ts` | snapshot → `Game`. Rejects a different version. |
| `SaveGameStorage.ts` | localStorage, plus JSON file export/import |
| `GameSerialization.test.ts` | Round-trip and version rejection |

The live model is a class. `JSON.stringify(game)` drops methods, so load
always goes through `GameDeserializer` and constructors.

Settings → Dev Mode gates the buttons. Save and Load use
`localStorage` key `incremental.devSave`. Export and Import use
`incremental-save.json`. The file has `version` and `savedAt`, plus miners from both bases, asteroids, the left base's money,
and the spawn clock, the player miner's speed, damage, fire rate, carry, and count levels, the mining size, spawn-rate, and golden spawn-rate levels, whether the mining tab, the tractor beam, golden asteroids, automine, the ship designer, the laser, the missile, the medium engine, and the large engine are owned, the cannon fire-rate and damage levels, the laser range and energy-reduction levels, the missile fire-rate and damage levels, the parts bolted to the designer core, the design copied for the rest of the game, which of those ships the fighter bar builds, any miner still waiting to launch, the production already spent on the miner and fighter at the front of those queues, each ship's role, health, and, when it was built from a saved design, that design's speed, shot damage, each powered weapon's type and range, the cooldown of each gun type, and colored squares, how many fighters are still building, the rival fleet cap, the wait toward the next replacement miner, the fighter speed, attack-rate, health, damage, capacity, and production levels, the miner production level, the enemy spawn-rate, capacity, health, damage, and attack-rate levels, and the next sidebar gift payout. Seat tokens are not in it. A shot records whether a base cannon fired it. Save format is 40. Whether each base cannon is in combat is saved. A missile shot records that its hit splashes. The lit cells of that blast are not saved. A miner shot records that it is drawn as a mining laser. The Ship Designer exports and imports the grid as `ship-design.json`. That file is not a game save.
