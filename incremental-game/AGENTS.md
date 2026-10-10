# AGENTS.md — incremental-game

Full guidance is in the [repository root AGENTS.md](../AGENTS.md).

## Commands (run from here)

```bash
npm run dev
npx vitest run
npx eslint src
npx tsc -b
npm run server:http
npm run server:mcp
```

## Layout

| Directory | Holds |
| --- | --- |
| `src/core/game/` | Glue. `Game` delegates to the map. |
| `src/core/map/` | Layout, spawn clock, and the step order. |
| `src/core/miner/` | Miners: flight, jobs, upgrades. |
| `src/core/base/` | Player bank. |
| `src/core/asteroid/`, `ore/`, `shot/`, `motion/` | Field pieces and movement. |
| `src/core/persistence/` | Save and load. No React, no browser APIs in `src/core/`. |
| `src/data/` | YAML settings, one file per module. `GameConfig` loads them. |
| `src/service/` | `GameService`: the only mutator the UI, HTTP, and MCP use |
| `src/server/` | HTTP and MCP adapters over `GameService` |
| `src/ui/` | React shell: sidebar, settings, save/load |

There is no turn loop. Do not add one.
