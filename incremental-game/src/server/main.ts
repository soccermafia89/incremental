import { GameService } from '../service/GameService'
import { normalizeServerUrl } from '../service/httpApi'
import { startHttpServer } from './http'
import { startMcpHttpProxy, startMcpStdio } from './mcp'

const DEFAULT_PORT = 8472

function printUsage(): void {
  process.stderr.write(`Incremental game server — one GameService, two adapters.

  npx vite-node src/server/main.ts -- --http [--port 8472]
  npx vite-node src/server/main.ts -- --mcp
  npx vite-node src/server/main.ts -- --mcp --url http://127.0.0.1:8472

HTTP is for curl and the React UI (?server=). MCP is JSON-RPC on stdin/stdout.
--mcp --url talks to an existing HTTP server instead of holding its own game.
Do not pass --http and --mcp together: MCP owns stdin.
`)
}

function parseArgs(argv: string[]): {
  http: boolean
  mcp: boolean
  port: number
  url: string | null
} {
  let http = false
  let mcp = false
  let port = DEFAULT_PORT
  let url: string | null = null
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--http') http = true
    else if (arg === '--mcp') mcp = true
    else if (arg === '--port' && argv[i + 1]) {
      port = Number(argv[++i])
    } else if (arg === '--url' && argv[i + 1]) {
      url = normalizeServerUrl(argv[++i] ?? '')
    } else if (arg === '--help' || arg === '-h') {
      printUsage()
      process.exit(0)
    }
  }
  return { http, mcp, port, url }
}

const args = parseArgs(process.argv.slice(2))
if (args.http && args.mcp) {
  process.stderr.write('Pass --http or --mcp, not both.\n')
  process.exit(1)
}
if (!args.http && !args.mcp) {
  printUsage()
  process.exit(1)
}
if (args.http && args.url) {
  process.stderr.write('--url is for --mcp only.\n')
  process.exit(1)
}

if (args.mcp && args.url) {
  process.stderr.write(`Incremental MCP proxying ${args.url}\n`)
  startMcpHttpProxy(args.url)
} else if (args.mcp) {
  const service = new GameService()
  setInterval(() => service.advance(100), 100)
  startMcpStdio(service)
} else {
  const service = new GameService()
  setInterval(() => service.advance(100), 100)
  const server = startHttpServer(service, args.port)
  server.listen(args.port, () => {
    process.stderr.write(`Incremental HTTP on http://127.0.0.1:${args.port}/\n`)
  })
}
