// Lokaler Server für public/ – wendet die Header aus vercel.json an, damit lokal dasselbe gilt wie bei Vercel.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pub = join(root, 'public');
const config = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
const port = Number(process.env.PORT) || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json',
};

function headersFor(path) {
  const out = {};
  for (const rule of config.headers || []) {
    if (new RegExp('^' + rule.source + '$').test(path)) for (const h of rule.headers) out[h.key] = h.value;
  }
  return out;
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(pub, path));
  if (!file.startsWith(pub)) { res.writeHead(403).end(); return; }
  try {
    if (!(await stat(file)).isFile()) throw new Error('kein File');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', ...headersFor(url.pathname) });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Nicht gefunden');
  }
}).listen(port, () => console.log(`Kobayashi Maru läuft auf http://localhost:${port}`));
