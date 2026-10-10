# Architecture

Dependencies point inward. No React in `src/core/`.

| Layer | Responsibility |
| --- | --- |
| `src/core/game/` | Glue. `Game` delegates to the map. `Clock` chops time into steps. |
| `src/core/map/` | The live map: layout, spawn clock, and the step order. |
| `src/core/miner/` | Miners: flight, jobs, upgrades, the once-a-second duty check. Loot in a map cell is taken by a random ship in that cell that still has room. After the tractor beam, rival miners hunt player ships, and the fighter hunts rivals. A fighter with no rival left flies to the enemy base and shoots it. A hostile rival with no player ship left flies to the player base and shoots it. Neither base has health, so those shots do not harm it. A destroyed rival miner returns to its base on the enemy spawn-rate clock, up to that fleet's cap. The cap starts at 1. Reaching three player miners doubles it, and golden asteroids multiply it by three. The enemy capacity upgrade sets it to 10 on the first purchase and adds 5 after that. Each of those purchases multiplies the bounty for a destroyed rival by 1.3, as do the health, damage, and attack-rate upgrades, which also raise the rival ships. Spawn rate does not. Rate 1 is one a minute, and each purchase doubles the rate so the wait halves, up to 128. |
| `src/core/base/` | The player bank. Each base has an auto-cannon. It shoots the nearest enemy ship inside `cannon.range`, `cannon.rate` times a second, for `cannon.damage`. The shot is a laser at `cannon.shotSpeed`, so it crosses that range in one frame. |
| `src/core/asteroid/` | Asteroid field, and what happens when a shot breaks one. |
| `src/core/ore/` | Ore nuggets. |
| `src/core/shot/` | Shots in flight. |
| `src/core/motion/` | Shared movement. |
| `src/core/persistence/` | Save and load. |
| `src/data/` | YAML settings, one file per module: map, asteroids, golden, ships, fighter, enemy, rival, ore, cannon, bank, upgrades, mining, designer. Fighter stats are `src/data/fighter/upgrades.yaml`. Enemy spawn rate and capacity are `src/data/enemy/upgrades.yaml`. `GameConfig` loads them. |
| `src/service/` | `GameService`: the only mutator the UI, HTTP, and MCP use |
| `src/server/` | Thin HTTP and MCP adapters over `GameService`. MCP protocol, stdio, and the HTTP proxy are separate modules. |
| `src/ui/` | React shell. `shell/` is the frame and the client session. Inline `style={{}}`. |

`GameService` is the mutable surface: `newGame`, `join`, `state`, `options`,
`act`, `save`, `load`. HTTP routes and MCP tools are generated from
`src/service/api.ts`. Adding an operation means adding it there once.

`options()` returns the legal actions. Miner upgrades are `{ "type": "upgradeMiner", "upgrade": "speed" | "damage" | "fireRate" | "carry" | "count" | "production" }`. `count` starts at 1 for the miner already at the base, and each purchase adds one. A destroyed miner is built again until that number is full. `production` is units built each second on the miner bar. A queued miner costs `ships.units`. Rate 1 fills that bar in 60 seconds. Mining upgrades are `{ "type": "upgradeMining", "upgrade": "unlock" | "size" | "spawnRate" | "goldenSpawnRate" | "golden" | "tractorBeam" }`. The Mining sidebar button is always shown. That page offers only `unlock` until it is bought, and `unlock` is the only mining action until then. `{ "type": "upgradeMining", "upgrade": "automine" }` costs `mining.automine.cost`. It clears every asteroid, stops further spawns, removes every player miner and the miner queue, and pays `mining.automine.perSecond` each second. The Mining button and the Miner card hide, and miner and mining purchases are no longer offered. `skipLevelOne` does not buy it. `{ "type": "unlockDesigner" }` costs `designer.cost` and adds the Ship Designer sidebar. `{ "type": "placeComponent", "component", "x", "y", "rotation" }` bolts that part onto the grid. The click is the part's local (0, 0), rotation is 0, 90, 180, or 270, and a mount must touch the opposite mount of a square already connected to the core. `{ "type": "removeComponent", "id" }` takes a part off when the rest of the ship stays connected to the core. `skipLevelOne` does not buy the designer. `goldenSpawnRate` is offered only after golden asteroids are owned. `{ "type": "upgradeFighter", "upgrade": "speed" | "attackRate" | "health" | "damage" | "count" | "production" }` buys one of its stats. `count` starts at 0 and is how many fighters are kept. The first purchase is free, the next costs `count.cost`, and the price doubles after that. A destroyed fighter is built again until that number is full. `production` is units built each second on the fighter bar. A queued fighter costs `fighter.units`. Rate 1 fills that bar in 60 seconds. Each production purchase makes the next build take 70% as long. These are offered only after the tractor beam is owned. `{ "type": "upgradeEnemy", "upgrade": "spawnRate" | "capacity" | "health" | "damage" | "attackRate" }` is offered only after the tractor beam is owned, when the Enemy tab appears. That screen opens onto Fighter, and Spawn rate and Capacity are on that page. `spawnRate` shortens how long a destroyed rival waits to return. `capacity` shows the live rival fleet cap. That cap starts at 1. Reaching three player miners doubles it, and golden asteroids multiply it by three. The first Capacity purchase sets the cap to 10, and each later purchase adds 5. New ships launch immediately. Health, damage, and attack rate raise the rival ships. Each Capacity, health, damage, and attack-rate purchase multiplies the payout for a destroyed rival by 1.3, and those factors compound. Spawn rate does not. The Enemy menu shows the net multiplier. A ship that destroys a rival pays the fighter bounty times that multiplier, rounded to the nearest dollar. A base cannon kill pays nothing. `{ "type": "skipLevelOne" }` maxes every miner upgrade and every upgrade on the Mining page, including its unlock, without spending money. Levels already bought stay put, and a second use changes nothing. `{ "type": "claimGift" }` pays the sidebar gift. The first payout is `bank.gift`, and each claim doubles the next one.
`act` applies one of those and refuses anything else. The UI and the adapters do not grow their own copies of the rules.

The screen is the Galactica shell: full-height column, 200px sidebar, a
centered main panel, a footer bar, Settings with Dev Mode. Map is the live
view. There is no turn and no end-turn batch. Local play advances from the
animation frame. The HTTP server advances its own game every 100ms.

## State and rendering

`App` owns the `GameClient`, the view, and settings. No store, no context.

The `Game` will be mutated in place. Bump `viewKey` after a change or React
will keep showing the old screen.
