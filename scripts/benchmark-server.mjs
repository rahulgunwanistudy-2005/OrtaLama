// Isolated test harness, not the product web application.
import http from 'node:http';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createFixtures } from '../circuits/test/fixtures.mjs';

const fixtures = await createFixtures();
const inputs = JSON.stringify({ simulation: true, below_threshold: fixtures.badge(), commitment_validity: fixtures.validity() }, (_, x) => typeof x === 'bigint' ? x.toString() : x);
await writeFile('circuits/ceremony/SIMULATED_benchmark_inputs.json', inputs + '\n');
const root = await realpath('.');
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/') { response.setHeader('Content-Type', 'text/html'); return response.end('<!doctype html><html lang="en"><title>SIMULATED proof benchmark</title><body><h1>SIMULATED proof benchmark</h1></body></html>'); }
    const file = await realpath(path.join(root, decodeURIComponent(url.pathname)));
    if (!file.startsWith(root + path.sep) || !(file.startsWith(root + '/circuits/') || file === root + '/node_modules/snarkjs/build/snarkjs.min.js')) { response.writeHead(403); return response.end(); }
    if (file.endsWith('.wasm')) response.setHeader('Content-Type', 'application/wasm');
    else if (file.endsWith('.js')) response.setHeader('Content-Type', 'application/javascript');
    else if (file.endsWith('.json')) response.setHeader('Content-Type', 'application/json');
    const bytes = await readFile(file);
    response.setHeader('Content-Length', bytes.length);
    response.end(bytes);
  } catch { response.writeHead(404); response.end(); }
});
server.listen(8791, '127.0.0.1', () => console.log('SIMULATED proof benchmark at http://127.0.0.1:8791'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
