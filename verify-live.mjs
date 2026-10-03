// Live check for the Chrome DevTools MCP wiring in this bundle.
//
// Starts the pinned server binary with the same arguments the
// dsh-experimental-browser-use-chrome-devtools-mcp provider builds, then drives
// it over stdio: list the catalog, open a URL, read the title, save a screenshot.
//
// Usage: node verify-live.mjs [url] [screenshot-path]
//
// DSH_MCP_CLI  server bin to start; required, since this repository does not
//              depend on the server it verifies.
// DSH_MCP_SDK  MCP client SDK dist directory; required.
// DSH_MCP_HEADLESS  'true' to run without a window, for a shell with no display.
// DSH_MCP_EXECUTABLE  Chrome or a wrapper to launch; unset uses upstream discovery.

import { writeFileSync } from 'node:fs'

const cli = process.env.DSH_MCP_CLI
const sdkDir = process.env.DSH_MCP_SDK
if (!cli || !sdkDir) throw new Error('set DSH_MCP_CLI and DSH_MCP_SDK')

const { Client } = await import(`${sdkDir}/index.mjs`)
const { StdioClientTransport } = await import(`${sdkDir}/stdio.mjs`)

const url = process.argv[2]
const out = process.argv[3]
// The bundle opens a visible window; a sandboxed shell without X access passes
// DSH_MCP_HEADLESS=true to reach the same server.
const headless = process.env.DSH_MCP_HEADLESS ?? 'false'
const executablePath = process.env.DSH_MCP_EXECUTABLE

const client = new Client({ name: 'dsh-live-check', version: '1.0.0' })
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    cli,
    '--no-usage-statistics',
    '--isolated',
    `--headless=${headless}`,
    ...executablePath === undefined ? [] : ['--executable-path', executablePath],
  ],
  stderr: 'inherit',
})

const call = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: args })
  return (result.content ?? []).map(part => part.type === 'text' ? part.text : `<${part.type}>`).join('\n')
}

await client.connect(transport)
const { tools } = await client.listTools()
console.log(`TOOLS (${tools.length}): ${tools.map(tool => tool.name).join(', ')}`)

if (url) {
  const open = tools.find(tool => tool.name === 'new_page') ?? tools.find(tool => tool.name === 'navigate_page')
  console.log(`OPEN via ${open.name}:\n${await call(open.name, { url })}`)

  const pages = await call('list_pages')
  const selected = /(\d+):[^\n]*\[selected\]/u.exec(pages) ?? /(\d+):/u.exec(pages)
  if (!selected) throw new Error(`no page id in list_pages output:\n${pages}`)
  const pageId = Number(selected[1])

  console.log(`TITLE (pageId ${pageId}):`, await call('evaluate_script', {
    pageId,
    function: '() => document.title',
  }))

  if (out) {
    const shot = await client.callTool({ name: 'take_screenshot', arguments: { pageId } })
    const image = (shot.content ?? []).find(part => part.type === 'image')
    if (!image) throw new Error(`no image in result: ${JSON.stringify(shot.content).slice(0, 400)}`)
    const bytes = Buffer.from(image.data, 'base64')
    writeFileSync(out, bytes)
    console.log(`SCREENSHOT ${out} (${bytes.length} bytes)`)
  }
}

await client.close()
console.log('CLOSED')
