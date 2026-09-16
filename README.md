# Node.5

Node.5 is an HTML-first Node.js toolkit for serving sites, running local package binaries, and managing project packages. It provides three commands:

- `node5`: serve HTML files or complete folders
- `n5pm`: install and list project packages
- `n5px`: run local package binaries and JavaScript files

## Requirements

- Node.js 18 or newer on Windows, macOS, or Linux
- npm, included with Node.js
- Playwright browsers only for `--pdf` and `--screenshot`

The core commands are cross-platform. Browser rendering uses the operating system's default opener: `start` on Windows, `open` on macOS, and `xdg-open` on Linux.

## Install

From a cloned checkout:

```powershell
npm install
npm link
```

The commands are then available globally:

```powershell
node5 --help
n5pm --help
n5px --help
```

To use the commands without linking, run them through Node from the project folder:

```powershell
node node5.js --help
node n5pm.js --help
node n5px.js --help
```

On Windows, `n5px.cmd` can be used if PowerShell resolves the `.ps1` shim unexpectedly:

```powershell
n5px.cmd --help
```

## Serve a site

Serve one HTML file:

```powershell
node5 index.html
```

Serve a complete folder with nested assets and `index.html` routes:

```powershell
node5 ./site --port 8080
```

The folder root serves `index.html`. Nested folders serve their own `index.html`, and assets are served recursively:

```text
site/
	index.html
	app.js
	styles.css
	docs/
		index.html
```

Then open `http://localhost:8080/` or `http://localhost:8080/docs/`.

Useful options:

```text
--render                 Open the site in the default browser
--pdf <output>           Export the page to PDF
--screenshot <output>    Export a screenshot
--port <number>          Select the HTTP port
```

The server also supports ETags, `Last-Modified`, gzip for text responses, `GET`/`HEAD`, cache headers, and protection against path traversal and symlink escapes.

## Install packages

`n5pm` uses npm for dependency resolution and installation, with cache-friendly defaults:

```powershell
n5pm install express
n5pm install vite typescript
n5pm install express --offline
n5pm install express --ignore-scripts
n5pm list
```

`n5pm` delegates dependency resolution to npm, updates `package.json`, and uses npm's lockfile and cache. Use `--ignore-scripts` for packages that do not need lifecycle setup. Some packages, including Electron, may require install scripts.

`--offline` uses only packages already available in the local npm cache. It fails instead of contacting the registry when required data is missing.

## Run packages and scripts

Run a local package binary:

```powershell
n5px vite
n5px tsc --noEmit
```

Run a local JavaScript entry file, such as an Express server:

```powershell
n5px server.js
```

`node5 run` is an equivalent convenience path:

```powershell
node5 run vite
node5 run server.js
```

The runner searches `node_modules/.bin` and `n5_modules/.bin`, forwards arguments and exit codes, and supports Windows `.cmd` package shims.

## Development

Run the smoke tests:

```powershell
npm test
```

Check the three CLI files without running them:

```powershell
node --check node5.js
node --check n5pm.js
node --check n5px.js
```

Build a Windows executable launcher with Node SEA:

```powershell
npm run build:exe
dist\node5.exe .\site --port 8080
```

The executable uses the Node engine and launches `node5.js` from the current
directory. It improves distribution and launcher convenience, but it does not
make JavaScript execution faster than Node itself. Set `NODE5_NODE` if Node is
not available on `PATH`.

## Troubleshooting

If a globally linked command is not found after `npm link`, open a new terminal so the updated npm bin directory is available on `PATH`. On Windows, try the generated command shim directly:

```powershell
n5px.cmd --help
```

If a package command is missing, install the package first:

```powershell
n5pm install <package>
```

## Status

Node.5 is experimental. Static serving and local command execution are the most mature paths. Package installation currently delegates dependency resolution to npm, so Node.5 is not yet a replacement for Bun, Node.js, or Deno.

## License

Apache-2.0. See [LICENSE](LICENSE).
