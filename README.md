# dsh-chrome-devtools

Let a DeepSeek Harness Agent control and inspect a live Chrome browser.

This bundle mounts [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)
as the Harness browser provider. The Agent gets the upstream DevTools tools, so
it can navigate, read the page, take screenshots, click and type, read console
messages and network requests, run scripts, record performance traces, and run
Lighthouse audits.

## What the Agent gets

29 tools, named `mcp__chrome-devtools-mcp__<tool>`:

| Area | Tools |
| --- | --- |
| Navigate | `new_page`, `navigate_page`, `select_page`, `close_page`, `list_pages`, `wait_for` |
| Read | `take_snapshot`, `take_screenshot`, `evaluate_script`, `get_console_message`, `list_console_messages` |
| Interact | `click`, `fill`, `fill_form`, `hover`, `drag`, `press_key`, `type_text`, `upload_file`, `handle_dialog` |
| Inspect | `list_network_requests`, `get_network_request`, `performance_start_trace`, `performance_stop_trace`, `performance_analyze_insight`, `lighthouse_audit` |
| Emulate | `emulate`, `resize_page`, `take_heapsnapshot` |

Once installed, ask for something like *"open example.com, screenshot it, and
report the console errors"*.

## Requirements

- DeepSeek Harness with the `plugin_manager` tool. Verified against `0.2.0-rc.2`.
- Google Chrome or Chrome for Testing, current stable. The bundle uses the
  upstream server's Chrome discovery, so a normal installation needs no setup.
- A desktop session. Launch mode opens a real window by default; see
  [Configuration](#configuration) for servers and CI.

## Install

Ask your DSH agent:

> Install the bundle `github:DevTarlow/dsh-chrome-devtools`.

The agent calls `plugin_manager` with `action: install_bundle` and that spec. To
pin a release, append its tag: `github:DevTarlow/dsh-chrome-devtools#<tag>`.

**Then start a new chat.** The provider connects a browser when a Session is
created, so a chat that was already open keeps running without one.

## Configuration

The bundle sets both rows. Change them by overriding the provider row by id in
your profile's `cordis.patch.yml`; the whole `config` block is replaced, so
restate every field you still want.

```yaml
- id: browser-use-chrome-devtools
  name: '@deepseek-ai/dsh-experimental-browser-use-chrome-devtools-mcp'
  config:
    mode: launch
    headless: true
```

| Field | Default here | Meaning |
| --- | --- | --- |
| `mode` | `launch` | `launch` starts an isolated Chrome per live Session; `attach` drives a browser you started yourself |
| `headless` | `false` | `false` opens a visible window; `true` runs without one, for servers and CI |
| `executablePath` | unset | Chromium to launch. Unset uses upstream discovery. Set it only for a non-standard install or a wrapper |
| `endpoint` | — | Required by `attach`: an `http://`, `https://`, `ws://`, or `wss://` browser debugging endpoint |
| `toolCallTimeoutMs` | MCP client default | Per-call timeout in milliseconds |

### Drive your own browser instead

`launch` gives each Session a fresh, isolated profile, so it starts logged out.
To use tabs, cookies, and logins you already have, start Chrome yourself and
attach:

```sh
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.dsh-chrome"
```

```yaml
- id: browser-use-chrome-devtools
  name: '@deepseek-ai/dsh-experimental-browser-use-chrome-devtools-mcp'
  config:
    mode: attach
    endpoint: http://127.0.0.1:9222
```

One Session holds the attachment at a time. Ending that Session disconnects and
leaves your browser running.

## Troubleshooting

**The browser tools are missing.** Start a new chat; the provider does not adopt
Sessions that were already open when it loaded.

**`No usable sandbox!`, or Chrome exits immediately.** Chrome cannot start with
its own sandbox on this host. This is common in containers and WSL, on Ubuntu
23.10+ where AppArmor restricts unprivileged user namespaces, and wherever
`/opt/google/chrome/chrome-sandbox` is not owned by `root` with mode `4755`.
Repairing that needs root. Otherwise launch Chrome through a wrapper that adds
`--no-sandbox`, and point `executablePath` at it:

```sh
printf '#!/bin/sh\nexec /usr/bin/google-chrome --no-sandbox "$@"\n' > ~/chrome-no-sandbox
chmod +x ~/chrome-no-sandbox
```

```yaml
        executablePath: /home/you/chrome-no-sandbox
```

This runs untrusted page content without OS sandboxing. Prefer repairing the
sandbox, and treat the wrapper as a last resort.

**`Missing X server to start the headful browser`.** The host has no display. Set
`headless: true`.

**A page shows a login wall, or the browser starts empty.** Launch mode starts
with a fresh profile by design. Use `attach` for a browser that is already
logged in.

**Screenshots arrive as text instead of an image.** The model route must accept
images, and the profile must have an attachment store, for the screenshot to
reach the model.

**Installing was rejected for incompatible peers.** The browser-use packages are
pre-stable and pin the DSH version exactly. Update the two `dependencies` in
`package.json` to the versions matching your Harness release.

## Limits

- One browser-use provider per composition. Do not also mount the Playwright or
  Stagehand providers.
- Chromium only. Firefox and WebKit are not selectable.
- A launched browser belongs to one Session. Reloading or resuming a Session
  starts fresh browser state; the Session log does not restore cookies or pages.
- Cancelling a call cannot undo a navigation or click already delivered.
- Tools that write a file — `take_screenshot`, `take_heapsnapshot`, a saved
  trace, a network response body — can only write under the operating system's
  temp directory. This integration passes no filesystem roots, so a path inside
  your project is refused with `Access denied: path … is not within any of the
  configured workspace roots`. Ask for screenshots as returned images instead:
  they reach the model as attachments without touching the filesystem.
- Tool schemas follow the pinned `chrome-devtools-mcp` release and carry no DSH
  stability promise.
- Usage statistics are disabled. Performance tools keep their upstream behavior,
  including sending trace URLs to the Google CrUX API.

## For maintainers

`verify-live.mjs` drives the pinned MCP server over stdio without a Harness: it
lists the tool catalog, opens a URL, reads the page title, and writes a
screenshot. Run it from a DeepSeek Harness source checkout.

```sh
cd packages/experimental/browser-use-chrome-devtools-mcp
export DSH_MCP_CLI=$(node --input-type=module -e "import {fileURLToPath} from 'node:url'; console.log(fileURLToPath(import.meta.resolve('chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js')))")
cd ../../..
export DSH_MCP_SDK=$PWD/packages/mcp/mcp-client/node_modules/@modelcontextprotocol/client/dist
DSH_MCP_HEADLESS=true node dsh-chrome-devtools/verify-live.mjs https://example.com dsh-chrome-devtools/live-check.png
```

`DSH_MCP_HEADLESS=true` is only for a sandboxed shell that cannot reach the X
server; the bundle itself launches a visible window. Set `DSH_MCP_EXECUTABLE` to
test a specific Chrome or a wrapper.

A profile that installs this bundle from a git spec installs its `dependencies`
too. A profile that links this directory as a local bundle does not, and the two
rows then resolve from whatever the Harness installation already carries; that is
how the author's development profile works, and it is why the dependency versions
above are pinned to the Harness release they were verified against.

## License

MIT
