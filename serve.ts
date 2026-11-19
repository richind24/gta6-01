// Solara Bay — tiny static server for game/ (Node 22, standard library
// only). A development convenience so the entry can be played locally
// without a build step: `node serve.ts` serves game/ on http://localhost:8080
// (or --port <n>). It refuses any path outside game/ and does nothing else.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(join(here, 'game'));
const portIndex = process.argv.indexOf('--port');
const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) || 8080 : 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = createServer((req, res) => {
  const rawPath = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  const target = resolve(join(root, normalize(rawPath).replace(/^(\.\.[/\\])+/, '')));
  if (!target.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
  let file = target;
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
  } catch { res.writeHead(404); res.end('not found'); return; }
  const ext = file.slice(file.lastIndexOf('.'));
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

server.listen(port, () => {
  console.log('Solara Bay at http://localhost:' + port + ' — open it in desktop Chrome');
});
