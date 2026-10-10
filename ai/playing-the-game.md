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

`options()` is the list of legal actions. Miner upgrades are `{ "type": "upgradeMiner", "upgrade": "speed" | "damage" | "fireRate" | "carry" | "count" | "production" }`. `count` starts at 1 for the miner already at the base, and each purchase adds one. A destroyed miner is built again until that number is full. `production` is units built each second on the miner bar. A queued miner costs `ships.units`. Rate 1 fills that bar in 60 seconds. Mining upgrades are `{ "type": "upgradeMining", "upgrade": "unlock" | "size" | "spawnRate" | "goldenSpawnRate" | "golden" | "tractorBeam" }`. The Mining sidebar button is always shown. That page offers only `unlock` until it is bought, and `unlock` is the only mining action until then. `{ "type": "upgradeMining", "upgrade": "automine" }` costs `mining.automine.cost`. It clears every asteroid, stops further spawns, removes every player miner and the miner queue, and pays `mining.automine.perSecond` each second. The Mining button and the Miner card hide, and miner and mining purchases are no longer offered. `skipLevelOne` does not buy it. `{ "type": "unlockDesigner" }` costs `designer.cost` and adds the Ship Designer sidebar. `{ "type": "placeComponent", "component", "x", "y", "rotation" }` bolts that part onto the grid. The click is the part's local (0, 0), rotation is 0, 90, 180, or 270, and a mount must touch the opposite mount of a square already connected to the core. `{ "type": "removeComponent", "id" }` takes a part off when the rest of the ship stays connected to the core. `skipLevelOne` does not buy the designer. `goldenSpawnRate` is offered only after golden asteroids are owned. `{ "type": "upgradeFighter", "upgrade": "speed" | "attackRate" | "health" | "damage" | "count" | "production" }` buys one of its stats. `count` starts at 0 and is how many fighters are kept. The first purchase is free, the next costs `count.cost`, and the price doubles after that. A destroyed fighter is built again until that number is full. `production` is units built each second on the fighter bar. A queued fighter costs `fighter.units`. Rate 1 fills that bar in 60 seconds. Each production purchase makes the next build take 70% as long. These are offered only after the tractor beam is owned. `{ "type": "upgradeEnemy", "upgrade": "spawnRate" | "capacity" | "health" | "damage" | "attackRate" }` is offered only after the tractor beam is owned, when the Enemy tab appears. That screen opens onto Fighter, and Spawn rate and Capacity are on that page. `spawnRate` shortens how long a destroyed rival waits to return. `capacity` shows the live rival fleet cap. That cap starts at 1. Reaching three player miners doubles it, and golden asteroids multiply it by three. The first Capacity purchase sets the cap to 10, and each later purchase adds 5. New ships launch immediately. Health, damage, and attack rate raise the rival ships. Each Capacity, health, damage, and attack-rate purchase multiplies the payout for a destroyed rival by 1.3, and those factors compound. Spawn rate does not. The Enemy menu shows the net multiplier. A ship that destroys a rival pays the fighter bounty times that multiplier, rounded to the nearest dollar. A base cannon kill pays nothing. `{ "type": "skipLevelOne" }` maxes every miner upgrade and every upgrade on the Mining page, including its unlock, without spending money. Levels already bought stay put, and a second use changes nothing. `{ "type": "claimGift" }` pays the sidebar gift. The first payout is `bank.gift`, and each claim doubles the next one.
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
