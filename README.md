# Chrome DevTools

Let your DeepSeek Harness Agent drive and inspect a real Chrome browser.

This plugin installs [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)
as the Harness browser provider, so the Agent works a Chrome window you can
watch. It opens pages, reads them, clicks and types, takes screenshots, reads
console messages and network requests, runs scripts, records performance traces,
and runs Lighthouse audits.

Chrome belongs to the chat that opened it. Close the chat and its browser goes
with it, so one conversation can never drive another one's pages.

## What you can ask for

- *"Open example.com, screenshot it, and tell me the console errors."*
- *"Go to my app on localhost:3000, sign up with a test account, and tell me
  whether the confirmation step works."*
- *"Record a performance trace on localhost:3000 and explain the largest
  contentful paint."*
- *"Run a Lighthouse audit on localhost:3000 and tell me what fails
  accessibility."*
- *"Screenshot that page at 375 pixels wide so I can check the mobile layout."*
- *"Click the thing that is broken and tell me exactly what the network request
  returns."*

## Install

1. In the Harness, open **Plugins** in the left sidebar.
2. Press **Install**.
3. Paste this repository's address:

   ```
   https://github.com/DevTarlow/dsh-chrome-devtools
   ```

4. Install it, then refresh the page.
5. **Start a new chat.** The Agent connects a browser when a chat begins, so a
   chat that was already open when you installed keeps running without one.

The install dialog accepts a GitHub address, a package name, or a local folder.
To pin the release this README describes, paste
`github:DevTarlow/dsh-chrome-devtools#v0.1.0` instead. If you would rather ask
your Agent, say: *"Install the bundle `github:DevTarlow/dsh-chrome-devtools`."*

You need Google Chrome (or Chrome for Testing) at its current stable version.
The plugin finds it by itself, so a normal installation needs no configuration.
You also need a desktop session, because the browser opens a real window.

## Check it works

In a new chat, ask:

> Open example.com and tell me its title and any console errors.

A Chrome window opens, loads the page, and the Agent answers from what it read.
If you would rather not open a window, see `headless` under [Settings](#settings).

## Settings

The plugin's defaults are set in [cordis.patch.yml](cordis.patch.yml). To change
one, put the same override in your own Harness profile's `cordis.patch.yml` — for
example `~/.dsh/profiles/web/cordis.patch.yml` — then start a new chat.

```yaml
- id: browser-use-chrome-devtools
  name: '@deepseek-ai/dsh-experimental-browser-use-chrome-devtools-mcp'
  config:
    mode: launch
    headless: true
```

Any setting you leave out falls back to the plugin's own default rather than this
bundle's, so restate every value you still want whenever you edit that block.

| Setting | Default | What it does |
| --- | --- | --- |
| `mode` | `launch` | `launch` starts a fresh Chrome for each chat. Use `attach` to drive a browser you started yourself. |
| `headless` | `false` | `false` opens a window you can watch. Set `true` on a server or in CI, where there is no display. |
| `executablePath` | unset | Which Chrome to launch. Left unset, the plugin finds it. Set it for an unusual install, or for the wrapper in [Common questions](#common-questions). |
| `endpoint` | — | Required by `attach`: the debugging address of the browser you started, such as `http://127.0.0.1:9222`. |
| `toolCallTimeoutMs` | the client's own | How long one tool call may take, in milliseconds. |

### Drive your own browser instead

`launch` gives every chat a fresh profile, which means it starts logged out. To
keep the tabs, cookies and logins you already have, start Chrome yourself and
point the plugin at it.

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

One chat holds that browser at a time. When the chat ends, the plugin disconnects
and leaves your browser running.

## Common questions

**The browser tools are missing.** Start a new chat. The plugin connects a
browser when a chat is created, so chats that were already open do not have one.

**Chrome exits immediately, or the Agent reports `No usable sandbox!`.** Chrome
cannot start with its own sandbox on your machine. This is common in containers
and WSL, on Ubuntu 23.10+ where AppArmor restricts unprivileged user namespaces,
and wherever `/opt/google/chrome/chrome-sandbox` is not owned by `root` with mode
`4755`. Repairing that needs root. Otherwise launch Chrome through a wrapper that
adds `--no-sandbox` and point `executablePath` at it:

```sh
printf '#!/bin/sh\nexec /usr/bin/google-chrome --no-sandbox "$@"\n' > ~/chrome-no-sandbox
chmod +x ~/chrome-no-sandbox
```

```yaml
        executablePath: /home/you/chrome-no-sandbox
```

That runs untrusted page content without the operating system's sandbox. Fix the
sandbox if you can, and treat the wrapper as a last resort.

**`Missing X server to start the headful browser`.** Your machine has no display.
Set `headless: true`.

**The page shows a login wall, or the browser starts empty.** That is what a
fresh profile looks like. Use `attach` above to bring your own logged-in browser.

**A screenshot arrives as text instead of a picture.** Your model route has to
accept images, and your profile needs an attachment store, for the image to reach
the model.

**Saving a screenshot to a file is refused.** The browser tools may only write
under your operating system's temp directory — a path inside your project is
answered with `Access denied: path … is not within any of the configured
workspace roots`. Ask for the screenshot as an image instead; it reaches the model
without touching the filesystem.

**Installing was rejected for incompatible peers.** The browser packages this
plugin builds on are pre-stable and pin the Harness version exactly. Update the
two `dependencies` in [package.json](package.json) to the versions that match your
Harness release.

## Limits

- One browser plugin per Harness. Do not also install the Playwright or Stagehand
  browser providers.
- Chromium only. Firefox and WebKit are not offered.
- A launched browser belongs to one chat. Reloading or resuming a chat starts
  fresh browser state; the conversation does not restore cookies or pages.
- Cancelling a call cannot undo a navigation or click that already happened.
- Tool definitions come from the pinned `chrome-devtools-mcp` release, not from
  the Harness, so they carry no stability promise.
- Usage statistics are off. Performance tools otherwise behave as upstream
  documents them, including sending trace URLs to the Google CrUX API.

## Removing it

Open **Plugins**, find **dsh-chrome-devtools**, and uninstall it. Chats you start
afterwards have no browser tools. If you added a `cordis.patch.yml` override,
delete that block too.

## For developers

This repository is a configuration-only bundle: two files, no build step.

| File | Owns |
| --- | --- |
| [cordis.patch.yml](cordis.patch.yml) | the two rows this bundle inserts and their defaults |
| [verify-live.mjs](verify-live.mjs) | a check that drives the MCP server without a Harness |

`verify-live.mjs` lists the tool catalog, opens a URL, reads the page title, and
writes a screenshot. Run it from a DeepSeek Harness source checkout:

```sh
cd packages/experimental/browser-use-chrome-devtools-mcp
export DSH_MCP_CLI=$(node --input-type=module -e "import {fileURLToPath} from 'node:url'; console.log(fileURLToPath(import.meta.resolve('chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js')))")
cd ../../..
export DSH_MCP_SDK=$PWD/packages/mcp/mcp-client/node_modules/@modelcontextprotocol/client/dist
DSH_MCP_HEADLESS=true node dsh-chrome-devtools/verify-live.mjs https://example.com dsh-chrome-devtools/live-check.png
```

Set `DSH_MCP_HEADLESS=true` only in a shell that cannot reach the X server; the
bundle itself opens a window. Set `DSH_MCP_EXECUTABLE` to test a particular Chrome
or a wrapper.

The two `dependencies` in `package.json` are the whole reason this plugin works on
a released Harness: the browser packages are not part of a published `dsh`, so
they install with the bundle. A profile that installs this repository from a git
spec installs them. A profile that links this directory as a local bundle does
not, and the rows then resolve from whatever the Harness installation carries.

## License

MIT
