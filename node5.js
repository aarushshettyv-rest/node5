#!/usr/bin/env bun
const { program } = require('commander');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const zlib = require('zlib');
const crypto = require('crypto');
const brand = 'node5';
const red = '\x1b[31m';
const reset = '\x1b[0m';

function reportError(message) {
  const cleanMessage = message.replace(/^error:\s*/i, '');
  const output = `${brand} error: ${cleanMessage}`;
  console.error(process.stderr.isTTY && !process.env.NO_COLOR
    ? `${red}${output}${reset}`
    : output);
}

// Define CLI options
program
  .name('node5')
  .version(require('./package.json').version)
  .description('HTML-first runtime with rendering')
  .argument('[file]', 'HTML file or folder to serve', 'index.html')
  .option('--render', 'Open in default browser')
  .option('--port <number>', 'Port to serve on', '3000')
  .option('--pdf <output>', 'Export to PDF using Playwright')
  .option('--screenshot <output>', 'Export to screenshot using Playwright');
program.allowExcessArguments();

// 👉 Custom error output (commander errors)
program.configureOutput({
  writeErr: (message) => reportError(message.trim())
});

// Parse arguments
program.parse(process.argv);
if (program.args[0] === 'run') {
  const result = spawnSync(process.execPath, [
    path.join(__dirname, 'n5px.js'),
    ...program.args.slice(1)
  ], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

const options = program.opts();
const target = program.args[0] || 'index.html';
let port = Number(options.port);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  reportError('port must be an integer between 0 and 65535');
  process.exit(1);
}
const targetPath = path.resolve(target);
const isDirectoryTarget = fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
const rootDir = isDirectoryTarget ? targetPath : path.dirname(targetPath);
const realRootDir = fs.realpathSync(rootDir);
const entryPath = isDirectoryTarget ? path.join(rootDir, 'index.html') : targetPath;
const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};
const compressibleTypes = new Set([
  'application/json',
  'application/javascript',
  'text/css',
  'text/html',
  'text/javascript',
  'image/svg+xml'
]);
const etagCache = new Map();
const gzipCache = new Map();
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
};

function getEtag(filePath, data, stats) {
  const cacheKey = `${filePath}:${stats.size}:${stats.mtimeMs}`;
  const cachedEtag = etagCache.get(cacheKey);
  if (cachedEtag) return cachedEtag;

  const etag = `"${crypto.createHash('sha1').update(data).digest('hex')}"`;
  etagCache.set(cacheKey, etag);
  if (etagCache.size > 1024) {
    etagCache.delete(etagCache.keys().next().value);
  }
  return etag;
}

// Serve the entry HTML and assets beside it.
const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, {
      ...securityHeaders,
      'Content-Type': 'text/plain',
      Allow: 'GET, HEAD'
    });
    res.end('Method not allowed');
    return;
  }

  let requestedPath;
  try {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    if (!isDirectoryTarget && requestUrl.pathname !== '/') {
      res.writeHead(404, { ...securityHeaders, 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }
    requestedPath = requestUrl.pathname === '/'
      ? entryPath
      : path.resolve(rootDir, `.${decodeURIComponent(requestUrl.pathname)}`);
  } catch {
    res.writeHead(400, { ...securityHeaders, 'Content-Type': 'text/plain' });
    res.end('Invalid request');
    return;
  }

  if (requestedPath !== entryPath && !requestedPath.startsWith(`${rootDir}${path.sep}`)) {
    res.writeHead(403, { ...securityHeaders, 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  try {
    requestedPath = fs.realpathSync(requestedPath);
  } catch {
    res.writeHead(404, { ...securityHeaders, 'Content-Type': 'text/plain' });
    res.end('File not found');
    return;
  }

  if (requestedPath !== realRootDir && !requestedPath.startsWith(`${realRootDir}${path.sep}`)) {
    res.writeHead(403, { ...securityHeaders, 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(requestedPath, (statErr, stats) => {
    if (!statErr && stats.isDirectory()) {
      requestedPath = path.join(requestedPath, 'index.html');
      try {
        requestedPath = fs.realpathSync(requestedPath);
        stats = fs.statSync(requestedPath);
      } catch {
        res.writeHead(404, { ...securityHeaders, 'Content-Type': 'text/plain' });
        res.end('File not found');
        return;
      }
      if (requestedPath !== realRootDir && !requestedPath.startsWith(`${realRootDir}${path.sep}`)) {
        res.writeHead(403, { ...securityHeaders, 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }
    }

    fs.readFile(requestedPath, (err, data) => {
      if (err) {
        res.writeHead(404, { ...securityHeaders, 'Content-Type': 'text/plain' });
        res.end('File not found');
      } else {
        const extension = path.extname(requestedPath).toLowerCase();
        const contentType = mimeTypes[extension] || 'application/octet-stream';
        const cacheControl = extension === '.html' || extension === '.json'
          ? 'no-cache'
          : 'public, max-age=3600';
        const etag = getEtag(requestedPath, data, stats);
        const lastModified = stats.mtime.toUTCString();
        const clientModifiedSince = req.headers['if-modified-since'];
        if (req.headers['if-none-match'] === etag
          || (!req.headers['if-none-match'] && clientModifiedSince === lastModified)) {
          res.writeHead(304, {
            ...securityHeaders,
            ETag: etag,
            'Last-Modified': lastModified,
            'Cache-Control': cacheControl
          });
          res.end();
          return;
        }
        const headers = {
          'Content-Type': contentType,
          'Cache-Control': cacheControl,
          Vary: 'Accept-Encoding',
          ETag: etag,
          'Last-Modified': lastModified
        };

        if (req.method === 'GET' && compressibleTypes.has(contentType)
          && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
          const cachedGzip = gzipCache.get(etag);
          if (cachedGzip) {
            res.writeHead(200, {
              ...securityHeaders,
              ...headers,
              'Content-Encoding': 'gzip',
              'Content-Length': cachedGzip.length
            });
            res.end(cachedGzip);
            return;
          }
          zlib.gzip(data, (gzipErr, compressed) => {
            if (gzipErr) {
              reportError(gzipErr.message);
              res.writeHead(500, { ...securityHeaders, 'Content-Type': 'text/plain' });
              res.end('Compression failed');
              return;
            }
            res.writeHead(200, {
              ...securityHeaders,
              ...headers,
              'Content-Encoding': 'gzip',
              'Content-Length': compressed.length
            });
            gzipCache.set(etag, compressed);
            if (gzipCache.size > 128) {
              gzipCache.delete(gzipCache.keys().next().value);
            }
            res.end(compressed);
          });
          return;
        }

        res.writeHead(200, { ...securityHeaders, ...headers, 'Content-Length': data.length });
        res.end(req.method === 'HEAD' ? undefined : data);
      }
    });
  });
});

let url;
const serverReady = new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, () => {
    server.removeListener('error', reject);
    port = server.address().port;
    resolve();
  });
});

process.on('SIGINT', () => {
  console.log('\nShutting down Node.5...');
  server.close(() => process.exit(0));
});

(async () => {
  try {
    await serverReady;
    url = `http://localhost:${port}`;
    console.log(`Serving ${target} at ${url}`);

    if (options.render) {
      console.log("Opening in your default browser...");
      const browserCommand = process.platform === 'win32'
        ? 'cmd.exe'
        : process.platform === 'darwin' ? 'open' : 'xdg-open';
      const browserArgs = process.platform === 'win32'
        ? ['/c', 'start', '', url]
        : [url];
      const browser = spawn(browserCommand, browserArgs, {
        detached: true,
        stdio: 'ignore'
      });
      browser.unref();
    }

    if (options.pdf || options.screenshot) {
      const { chromium } = require('playwright');
      const browser = await chromium.launch();
      const page = await browser.newPage();
      await page.goto(url);
      if (options.pdf) {
        await page.pdf({ path: options.pdf, format: 'A4' });
        console.log(`PDF saved as ${options.pdf}`);
      }
      if (options.screenshot) {
        await page.screenshot({ path: options.screenshot });
        console.log(`Screenshot saved as ${options.screenshot}`);
      }
      await browser.close();
      server.close();
    }
  } catch (err) {
    reportError(err.message);
    server.close();
  }
})();

// 👉 Global error handling (Node.js runtime errors)
process.on('uncaughtException', (err) => {
  reportError(err.message);
});

process.on('unhandledRejection', (reason) => {
  reportError(reason instanceof Error ? reason.message : String(reason));
});
