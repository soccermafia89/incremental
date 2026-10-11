#!/usr/bin/env node
/**
 * Drive the running dev server in headless Chrome and capture PNGs.
 *
 * No dependencies: uses Node's built-in WebSocket (Node >= 22) to speak the
 * Chrome DevTools Protocol directly. Playwright is not installed in this repo.
 *
 * Usage:
 *   node ai/scripts/screenshot.mjs <url> <outdir> [step...]
 *
 * Steps run in order:
 *   shot:<name>     capture <outdir>/<name>.png
 *   click:<text>    click the button whose trimmed text equals <text>
 *   check:x         tick the first unchecked checkbox on the page (the arg is ignored)
 *   repeat:<text>:<n>  click a button n times
 *   sleep:<ms>      wait
 *   eval:<js>       evaluate JS and print the result
 *
 * Example:
 *   node ai/scripts/screenshot.mjs http://localhost:5173/ /tmp/shots \
 *     shot:map \
 *     "eval:document.querySelector('[data-nav=\"designer\"]').click()" \
 *     shot:designer
 *
 * The viewport is 1400x800 at device scale 2. Set VIEWPORT=1400x1100 (for
 * example) to check layouts in a taller window.
 *
 * Chrome must already be running with remote debugging. See
 * ai/running-and-screenshots.md for the exact launch command.
 */
const PORT = process.env.CDP_PORT ?? 9222;
const VIEWPORT = process.env.VIEWPORT ?? '1400x800';
const [VIEWPORT_W, VIEWPORT_H] = VIEWPORT.split('x').map(Number);
if (!(VIEWPORT_W > 0 && VIEWPORT_H > 0)) {
  console.error(`VIEWPORT must look like 1400x800, got: ${VIEWPORT}`);
  process.exit(1);
}
const [url, outdir, ...steps] = process.argv.slice(2);

if (!url || !outdir) {
  console.error('usage: node ai/scripts/screenshot.mjs <url> <outdir> [step...]');
  process.exit(1);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function findPageTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = list.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* Chrome not listening yet */ }
    await sleep(200);
  }
  throw new Error(`No Chrome page target on port ${PORT}. Is Chrome running with --remote-debugging-port?`);
}

const ws = new WebSocket(await findPageTarget());
await new Promise(r => ws.addEventListener('open', r, { once: true }));

let nextId = 1;
const pending = new Map();
const consoleErrors = [];

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  }
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
});

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description ?? JSON.stringify(exceptionDetails));
  }
  return result.value;
}

const buttonExpr = (text, action) =>
  `(() => { const b = [...document.querySelectorAll('button')]` +
  `.find(x => x.textContent.trim() === ${JSON.stringify(text)}); if (!b) return false; ${action}; return true; })()`;

/** Poll rather than sleep: the app re-renders asynchronously. */
async function clickButton(text) {
  for (let i = 0; i < 40; i++) {
    if (await evaluate(buttonExpr(text, 'b.click()'))) return;
    await sleep(250);
  }
  throw new Error(`button never appeared: ${text}`);
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync(outdir, { recursive: true });
  writeFileSync(`${outdir}/${name}.png`, Buffer.from(data, 'base64'));
  console.log(`captured ${outdir}/${name}.png`);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: VIEWPORT_W, height: VIEWPORT_H, deviceScaleFactor: 2, mobile: false
});

await send('Page.navigate', { url });

// A blank page means the app failed to mount — fail loudly rather than
// capturing an empty screenshot that looks like a successful run.
let mounted = 0;
for (let i = 0; i < 60 && mounted === 0; i++) {
  await sleep(250);
  mounted = await evaluate(`document.getElementById('root')?.children.length ?? 0`);
}
if (mounted === 0) {
  console.error('App did not mount. Captured console errors:');
  consoleErrors.forEach(e => console.error('  ' + e));
  console.error('\nIf you see "Error creating WebGL context", relaunch Chrome with the');
  console.error('SwiftShader flags from ai/running-and-screenshots.md.');
  process.exit(1);
}

for (const step of steps) {
  const idx = step.indexOf(':');
  const kind = step.slice(0, idx);
  const arg = step.slice(idx + 1);

  if (kind === 'shot') await shot(arg);
  else if (kind === 'click') await clickButton(arg);
  else if (kind === 'sleep') await sleep(Number(arg));
  else if (kind === 'check') {
    await evaluate(`(() => { const c = document.querySelector('input[type=checkbox]:not(:checked)'); if (c) c.click(); })()`);
  } else if (kind === 'repeat') {
    const at = arg.lastIndexOf(':');
    const [label, times] = [arg.slice(0, at), Number(arg.slice(at + 1))];
    for (let i = 0; i < times; i++) { await clickButton(label); await sleep(80); }
  } else if (kind === 'eval') {
    console.log(JSON.stringify(await evaluate(arg)));
  } else {
    throw new Error(`unknown step: ${step}`);
  }
  await sleep(400);
}

if (consoleErrors.length) {
  console.log('\nPage exceptions during run:');
  consoleErrors.forEach(e => console.log('  ' + e.split('\n')[0]));
}

ws.close();
