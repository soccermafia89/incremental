# How to play

Run these from this directory (the one that contains `package.json`). `npm install` once, the first time.

**Local**
```bash
npm install
npm run dev
```
Open the URL Vite prints. No `?server=`.

**Shared (this tab and an agent)**
```bash
npm run server:http          # terminal 1, leave running
npm run dev                  # terminal 2
```
Open `http://localhost:5173/?server=http://127.0.0.1:8472` (use Vite’s port if not 5173).

**Agent on the shared game:** `.cursor/mcp.json` already points at `server:mcp`. Reconnect MCP, then start a new chat.

**Agent-only (private):** `npm run server:mcp`

The Game view is empty. Settings → Dev Mode unlocks save, load, export, and import.
