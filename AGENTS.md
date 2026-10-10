# AGENTS.md

Instructions for AI coding agents. Deep-dive docs live in [`ai/`](ai/). Humans
start at [HOW-TO-PLAY.md](HOW-TO-PLAY.md).

This repo has Galactica’s shell: dependencies, folders, save format, screen
layout, and the HTTP/MCP server. It does not have Galactica’s game, and it
does not have a turn loop. The map runs on real time: `Game.advance(dtMs)`.

## Setup

The app code lives in `incremental-game/`. `npm` scripts in this directory forward there, so `npm run dev` works from here.

```bash
npm install
npm run dev
```

`npx vitest`, `npx eslint`, and `npx tsc` read config inside `incremental-game/`. Run those from that directory.

## Commands

| Task | Command |
| --- | --- |
| Run the app | `npm run dev` |
| Run tests | `npx vitest run` |
| Run one test file | `npx vitest run src/path/to/File.test.ts` |
| Lint | `npx eslint src` |
| Type-check | `npx tsc -b` |
| Headless game server | `npm run server:http` or `npm run server:mcp` |
| Shared browser + agent | `npm run server:http`, then open `http://localhost:5173/?server=http://127.0.0.1:8472` |

## Keep the checks green

`npm run build`, `npx tsc -b`, `npx eslint src`, and `npx vitest run` should
all pass. There is no CI.

## Stack

- **Vite + React 19 + TypeScript.** The same dependency set as Galactica,
  including Three and MUI. Do not reach for MUI. Style with inline `style={{}}`.
- **Balance numbers are YAML** under `incremental-game/src/data/`, one file per module, loaded via Vite `?raw`.

## Code style

- Domain types are an `interface` plus an `Impl` class. Mutation goes through
  methods, not direct field assignment.
- Compare ids by `id.value`, never by object reference.
- No state management library and no React context. State lives in `App`.
- The `Game` is mutated in place. After a mutation, bump state in `App` or
  the screen lies.
- Write the current model only. Bump `SAVE_FORMAT_VERSION` when the snapshot
  shape changes. Do not keep removed fields so old saves still load.

## Testing

Vitest. Tests sit next to the code as `*.test.ts`. There is no jsdom setup.
Tests cover domain logic, not React components. If you change `src/core/`,
add or update a test.

## Before you report a change as done

1. `npx vitest run` passes.
2. `npx eslint src` is clean — 0 errors and 0 warnings.
3. `npm run build` succeeds.

## Deep dives

| Doc | Read when |
| --- | --- |
| [`ai/gotchas.md`](ai/gotchas.md) | **Always.** |
| [`ai/architecture.md`](ai/architecture.md) | Where the layers are |
| [`ai/persistence.md`](ai/persistence.md) | Save/load, or a domain shape change |
| [`ai/playing-the-game.md`](ai/playing-the-game.md) | curl, MCP, or `?server=` |

## Keeping docs honest

If you learn something non-obvious, add it to `ai/`. Do not catalog features
that are not built. If an entry is wrong, fix or delete it.
