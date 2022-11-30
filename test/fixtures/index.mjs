import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createSecureServer } from 'node:http2';
import routes from './routes.mjs';

const baseB1URL = new URL('http://localhost:1081');
const baseB2URL = new URL('https://localhost:1083');
const baseH1URL = new URL('http://localhost:3000');
const baseH2URL = new URL('https://localhost:3443');

Object.assign(globalThis, {
  baseB1URL,
  baseB2URL,
  baseH1URL,
  baseH2URL,
});

export async function mochaGlobalSetup() {
  const cwd = process.cwd();
  const cert = readFileSync(`${ cwd }/localhost.cert`);
  const key = readFileSync(`${ cwd }/localhost.key`);

  this.b1server = createServer(routes(baseB1URL));
  this.b2server = createSecureServer({ cert, key }, routes(baseB2URL));
  this.h1server = createServer(routes(baseH1URL));
  this.h2server = createSecureServer({ cert, key }, routes(baseH2URL));

  await Promise.all([
    once(this.b1server.listen(baseB1URL.port), 'listening'),
    once(this.b2server.listen(baseB2URL.port), 'listening'),
    once(this.h1server.listen(baseH1URL.port), 'listening'),
    once(this.h2server.listen(baseH2URL.port), 'listening'),
  ]);
  console.log('b1 server listening on', this.b1server.address());
  console.log('b2 server listening on', this.b2server.address());
  console.log('h1 server listening on', this.h1server.address());
  console.log('h2 server listening on', this.h2server.address());
}

export async function mochaGlobalTeardown() {
  await Promise.all([
    once(this.b1server.close(), 'close'),
    once(this.b2server.close(), 'close'),
    once(this.h1server.close(), 'close'),
    once(this.h2server.close(), 'close'),
  ]);
  console.log('server(s) has been closed');
}
