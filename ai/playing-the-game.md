# Playing without the UI

Human start recipes: [HOW-TO-PLAY.md](../HOW-TO-PLAY.md).

The React app, curl, and MCP all drive **one class**: `GameService`.

```
                         GameService
           newGame · join · state · options · act · save · load
                               |
              +----------------+----------------+
              |                                 |
         LocalGameClient                  HTTP :8472
         (default npm run dev)                  |
                                          +-----+------+
                                          |            |
                                   ?server= UI    MCP --url
                                   curl           (or private --mcp)
```

`options()` is the list of legal actions. Miner upgrades are `{ "type": "upgradeMiner", "upgrade": "speed" | "damage" | "fireRate" | "carry" | "count" | "production" }`. `count` starts at 1 for the miner already at the base, and each purchase adds one. A destroyed miner is built again until that number is full. `production` is units built each second on the miner bar. A queued miner costs `ships.units`. Rate 1 fills that bar in 60 seconds. A miner is drawn as a prebuilt ship: the designer core, a thruster, and a miner laser. That shot is a short yellow beam. Miner upgrades still set its speed, damage, fire rate, carry, and the rest. Mining upgrades are `{ "type": "upgradeMining", "upgrade": "unlock" | "size" | "spawnRate" | "goldenSpawnRate" | "golden" | "tractorBeam" }`. The Mining sidebar button is always shown. That page offers only `unlock` until it is bought, and `unlock` is the only mining action until then. `{ "type": "upgradeMining", "upgrade": "automine" }` is offered only after the tractor beam is owned and costs `mining.automine.cost`. It clears every asteroid, stops further spawns, removes every player miner and the miner queue, and pays `mining.automine.perSecond` each second. Rivals do not fly back to their base. The Mining button and the Miner card hide, and miner and mining purchases are no longer offered. `skipLevelOne` does not buy it. `{ "type": "unlockDesigner" }` costs `designer.cost` and adds the Ship Designer sidebar. `{ "type": "placeComponent", "component", "x", "y", "rotation" }` bolts that part onto the grid. The click is the part's local (0, 0), rotation is 0, 90, 180, or 270, and a mount must touch the opposite mount of a square already connected to the core. `{ "type": "saveDesign" }` copies that grid into the game. That copy is what the rest of the game uses. Editing the grid does not change it until `saveDesign` runs again. Export writes the grid to `ship-design.json`. Import replaces the grid from that file and leaves the copied production design until `saveDesign`. `{ "type": "resetDesign" }` clears the grid the same way. Delete is a tool: once it is selected, clicking a part takes that part off. `{ "type": "chooseProduction", "design": "fighter" | "saved" }` picks which of those ships the fighter bar builds. `saved` is offered only after a design has been copied. The Fleet Design screen shows that ship's build cost and shape. A saved design flies at its speed times `ships.speed`, and on the map it is those colored squares. Each shot deals `designer.weaponDamage`. Each gun type keeps its own timer. Extra guns of that type shorten its wait. After the designer is owned, the Weapons tab on Ship Upgrades sells a laser and a missile. The laser is long range and spends a whole energy block. Its shot hits immediately and draws a line from the ship to the target, blue for the player and red for a rival. The line stays for 200 ms. Its upgrades raise that range and lower the energy it draws. The missile is medium range and costs much more to buy and to build. It flies at half the shot speed and is drawn as a longer projectile. One missile starts at 30 damage and fires every 5000 ms. Its upgrades raise fire rate and damage. The cannon comes with the designer. It starts at 10 damage and fires every 1000 ms, and the same tab raises its fire rate and damage. Ship Upgrades also sells a medium engine and a large engine. They cover more cells, draw more energy, and push harder than the stock thruster. A missile hit also deals half that damage to enemy ships in a round patch of map cells, about three and a half cells from the impact. Those cells light up, then fade. A ship closes until its shortest powered gun is in range, then stops. Longer guns fire on the way in, and only guns that reach add to that type's fire rate. The default fighter still uses the fighter speed, damage, attack-rate, and health upgrades. It is drawn with the same hull as a miner. A saved design's health is the core plus its structural and armor blocks, and the fighter health upgrade does not change those ships. Each placed part adds build units, the same production units a fighter takes, and the designer shows that total. Each part also adds weight. Thrusters add thrust. Speed is thrust divided by weight. Every part consumes energy, and energy parts grant more than one part uses. `{ "type": "removeComponent", "id" }` takes a part off when the rest of the ship stays connected to the core. `skipLevelOne` does not buy the designer. `{ "type": "upgradesToShipDesign" }` maxes miner speed, damage, fire rate, carry, count, and production; mining unlock, size, spawn rate, golden asteroids, golden spawn rate, and the tractor beam; fighter speed, attack rate, health, damage, count, and production; and enemy spawn rate, capacity, health, damage, and attack rate. It also unlocks the ship designer, the laser, the missile, and the medium and large engines, and it turns on automine. Each level uses the same effects as buying it, and nothing is charged. An upgrade added later is not on that list. `goldenSpawnRate` is offered only after golden asteroids are owned. `{ "type": "upgradeFighter", "upgrade": "speed" | "attackRate" | "health" | "damage" | "count" | "production" }` buys one of its stats. `count` starts at 0 and is how many fighters are kept. The first purchase is free, the next costs `count.cost`, and the price doubles after that. A destroyed fighter is built again until that number is full. `production` is units built each second on the fighter bar. A queued fighter costs `fighter.units`. The starting rate fills that bar in 60 seconds. Each production purchase makes the next build take 70% as long. These are offered only after the tractor beam is owned. `{ "type": "upgradeEnemy", "upgrade": "spawnRate" | "capacity" | "health" | "damage" | "attackRate" }` is offered only after the tractor beam is owned, when the Enemy tab appears. That screen opens onto Fighter, and Spawn rate and Capacity are on that page. `spawnRate` shortens how long a destroyed rival waits to return. `capacity` shows the live rival fleet cap. That cap starts at 1. Reaching three player miners doubles it, and golden asteroids multiply it by three. The first Capacity purchase sets the cap to 10, and each later purchase adds 5. New ships launch immediately. Health, damage, and attack rate raise the rival ships. Each Capacity, health, damage, and attack-rate purchase multiplies the payout for a destroyed rival by 1.3, and those factors compound. Spawn rate does not. The Enemy menu shows the net multiplier. A ship that destroys a rival pays the fighter bounty times that multiplier, rounded to the nearest dollar. A base cannon kill pays nothing. `{ "type": "skipLevelOne" }` maxes every miner upgrade and every upgrade on the Mining page, including its unlock, without spending money. Levels already bought stay put, and a second use changes nothing. `{ "type": "claimGift" }` pays the sidebar gift. The first payout is `bank.gift`, and each claim doubles the next one.
`act` returns `{ ok: false, reason, error }` for anything else.

## Shared play

```bash
cd incremental-game
npm run server:http
npm run dev
# browser: http://localhost:5173/?server=http://127.0.0.1:8472
```

Opening `?server=` joins if a game exists (`POST /join`), and calls
`POST /new-game` when the server has none. The response includes a token.
The browser stores it in `sessionStorage` and sends `X-Incremental-Token`
on later requests. Refresh resumes that seat.

Save is the game only. Tokens are not in the file. New Game and Load clear
seats, then sit the caller again.

The UI polls `/state` every 2 seconds and reloads `/save` when `revision`
changes.

## curl

```bash
PORT=8472
TOKEN=$(curl -s -X POST http://localhost:$PORT/new-game \
  -H 'Content-Type: application/json' -d '{}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])')

curl -s http://localhost:$PORT/state -H "X-Incremental-Token: $TOKEN"
curl -s http://localhost:$PORT/options -H "X-Incremental-Token: $TOKEN"
curl -s http://localhost:$PORT/save -H "X-Incremental-Token: $TOKEN"
```

`GET /` prints the route list.
