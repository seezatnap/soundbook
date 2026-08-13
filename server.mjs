import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const appName = process.env.APP_NAME ?? 'soundbook';
const host = process.env.HOSTNAME ?? '0.0.0.0';
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const publicDirectory = resolve(fileURLToPath(new URL('./dist/', import.meta.url)));

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(body);
}

async function resolveAsset(pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = resolve(publicDirectory, relativePath);

  if (candidate !== publicDirectory && !candidate.startsWith(`${publicDirectory}${sep}`)) {
    return null;
  }

  try {
    const candidateStat = await stat(candidate);
    if (candidateStat.isFile()) return { path: candidate, stat: candidateStat };
    if (candidateStat.isDirectory()) {
      const indexPath = resolve(candidate, 'index.html');
      return { path: indexPath, stat: await stat(indexPath) };
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const indexPath = resolve(publicDirectory, 'index.html');
  return { path: indexPath, stat: await stat(indexPath) };
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');

    if (requestUrl.pathname === '/api/health') {
      const body = JSON.stringify({ app: appName, status: 'ok' });
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      });
      response.end(request.method === 'HEAD' ? undefined : body);
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      sendText(response, 405, 'Method Not Allowed\n');
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(requestUrl.pathname);
    } catch {
      sendText(response, 400, 'Bad Request\n');
      return;
    }

    const asset = await resolveAsset(pathname);
    if (!asset) {
      sendText(response, 403, 'Forbidden\n');
      return;
    }

    response.writeHead(200, {
      'Cache-Control': pathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
      'Content-Length': asset.stat.size,
      'Content-Type': contentTypes[extname(asset.path)] ?? 'application/octet-stream',
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    await pipeline(createReadStream(asset.path), response);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) sendText(response, 500, 'Internal Server Error\n');
    else response.destroy();
  }
});

server.listen(port, host, () => {
  console.log(`${appName} listening on http://${host}:${port}`);
});
