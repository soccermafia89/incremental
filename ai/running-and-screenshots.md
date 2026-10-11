# Running the app and taking screenshots

One-off screenshots of the running app. There is no Playwright and no Chrome
test suite in this repo.

Human start recipes: [HOW-TO-PLAY.md](../HOW-TO-PLAY.md).

```bash
npm run dev
```

Run that from the repo root. Vite prints the URL. **It is not always 5173** —
if that port is taken it silently moves, so read the output. That is a private
in-process game. To attach to `npm run server:http`, open
`http://localhost:<vite>/?server=http://127.0.0.1:8472`. See
[playing-the-game.md](playing-the-game.md).

Do not restart a dev server that is already running. `loadGameConfig()` is
cached for the process lifetime, so a YAML change needs a restart and a new
game. A domain method change needs a full page reload. Vite HMR updates React,
not a live `GameImpl`.

## One-off screenshots

No Playwright. Drive Chrome over CDP with
[`scripts/screenshot.mjs`](scripts/screenshot.mjs) (Node >= 22, built-in
`WebSocket`).

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --remote-debugging-port=9222 \
  --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader \
  --user-data-dir=/tmp/inc-chrome --no-first-run --window-size=1400,800 \
  about:blank &

node ai/scripts/screenshot.mjs <url> <outdir> [step...]
```

If port 9222 is already taken, pick another and set `CDP_PORT` to the same
number for the script.

| Step | Effect |
| --- | --- |
| `shot:<name>` | capture `<outdir>/<name>.png` |
| `click:<text>` | click the button whose trimmed text equals `<text>` |
| `check:x` | tick the first unchecked checkbox (the `x` is ignored) |
| `repeat:<text>:<n>` | click a button `n` times |
| `sleep:<ms>` | wait |
| `eval:<js>` | evaluate JS and print the result |

`click:` needs the whole button text. Click sidebar entries by their `data-nav`
view instead. Some sidebar entries stay hidden until they are bought.

```bash
node ai/scripts/screenshot.mjs http://localhost:5173/ /tmp/shots \
  "eval:document.querySelector('[data-nav=\"designer\"]').click()" \
  shot:designer
```

The page is 1400×800 at device scale 2. To check a taller or wider window, set
`VIEWPORT`, e.g. `VIEWPORT=1400x1600 node ai/scripts/screenshot.mjs ...`. The
ship designer grid is taller than 800px.

Read the PNGs. A blank frame is a failed run. The script polls for the app to
mount (up to 15 s) and hard-fails if `#root` stays empty.

Chrome takes a moment to exit, so wait before removing its profile:

```bash
pkill -f inc-chrome; while pgrep -f inc-chrome >/dev/null; do sleep 0.2; done; rm -rf /tmp/inc-chrome
```

Vite HMR reloads the page when you edit. Re-run the script; do not reuse a
stale tab.
