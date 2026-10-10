/** Newline-delimited JSON on stdin, one reply per line on stdout. */
export function startStdioLoop(handler: (line: string) => string | null | Promise<string | null>): void {
  let buffer = ''
  let chain = Promise.resolve()
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      chain = chain.then(async () => {
        const out = await handler(line)
        if (out !== null) process.stdout.write(out + '\n')
      })
    }
  })
  process.stdin.on('end', () => process.exit(0))
}
