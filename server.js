import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import quotesHandler from './api/quotes.js';
import healthHandler from './api/health.js';

const root = path.dirname(fileURLToPath(import.meta.url));

async function loadEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index < 1) continue;
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

await loadEnvFile(path.join(root, '.env.local'));
await loadEnvFile(path.join(root, '.env'));
process.env.LOCAL_DB_FILE ||= path.join(root, '.data', 'quotes.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2_000_000) throw new Error('Request body exceeds 2 MB.');
    chunks.push(chunk);
  }
  if (!chunks.length) return undefined;
  const raw = Buffer.concat(chunks).toString('utf8');
  const type = String(req.headers['content-type'] || '');
  return type.includes('application/json') ? JSON.parse(raw || '{}') : raw;
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const requested = path.normalize(path.join(root, pathname));
  if (!requested.startsWith(root) || requested.includes(`${path.sep}.data${path.sep}`) || requested.includes(`${path.sep}lib${path.sep}`)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  try {
    const stat = await fs.stat(requested);
    const filePath = stat.isDirectory() ? path.join(requested, 'index.html') : requested;
    const data = await fs.readFile(filePath);
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    throw error;
  }
}

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/api/quotes' || pathname === '/api/quotes.js') {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) req.body = await readBody(req);
      await quotesHandler(req, res);
      return;
    }
    if (pathname === '/api/health' || pathname === '/api/health.js') {
      await healthHandler(req, res);
      return;
    }
    await serveStatic(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    if (!res.writableEnded) res.end(JSON.stringify({ error: { code: 'local_server_error', message: error.message } }));
  }
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => {
  console.log(`ITEM-Quote running at http://${host}:${port}`);
  console.log(`Local admin key: ${process.env.ADMIN_KEY || 'local-dev-key'}`);
  console.log(`Storage: ${process.env.DATABASE_URL ? 'PostgreSQL/Neon' : process.env.LOCAL_DB_FILE}`);
});
