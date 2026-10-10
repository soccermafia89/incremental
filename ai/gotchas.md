# Gotchas

## There is no save compatibility layer

When a field goes away, delete it from the snapshot, the deserializer, and
the tests. Bump `SAVE_FORMAT_VERSION`. Do not leave an optional field so an
old file still loads.

## There is no CI

`npm run dev` strips types without checking them. Run tests, lint, `tsc -b`,
and build yourself.

## Re-rendering is manual

No store, no context. After `GameService` mutates the live game, `App` has
to set state (`viewKey`) or the screen stays stale.

**Domain method changes need a full reload.** Vite HMR updates React modules.
A live `GameImpl` keeps the methods from when the page loaded.

## Seats are not in the save file

HTTP tokens live in `SeatTable` and in `sessionStorage`. New Game and Load
clear the table. The JSON file is the game only.

## MUI and Three are installed and unused

They are on the dependency list so this project matches Galactica’s toolchain.
Do not build the UI out of MUI. Do not add a Three view until the game needs one.
