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
and the spawn clock, the player miner's speed, damage, fire rate, carry, and count levels, the mining size, spawn-rate, and golden spawn-rate levels, whether the mining tab, the tractor beam, and golden asteroids are owned, any miner still waiting to launch, the production already spent on the miner and fighter at the front of those queues, each ship's role and health, how many fighters are still building, the rival fleet cap, the wait toward the next replacement miner, the fighter speed, attack-rate, health, damage, capacity, and production levels, the miner production level, the enemy spawn-rate, capacity, health, damage, and attack-rate levels, and the next sidebar gift payout. Seat tokens are not in it. Save format is 24.
