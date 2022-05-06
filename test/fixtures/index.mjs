import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createSecureServer } from 'node:http2';
import routes from './routes.mjs';

const baseH1URL = new URL('http://localhost:3000');
const baseH2URL = new URL('https://localhost:3443');

Object.assign(globalThis, {
  baseH1URL,
  baseH2URL,
});

export async function mochaGlobalSetup() {
  this.h1server = createServer(routes(baseH1URL));
  this.h2server = createSecureServer({
    cert: readFileSync(`${ process.cwd() }/localhost.cert`),
    key: readFileSync(`${ process.cwd() }/localhost.key`),
  }, routes(baseH2URL));

  await Promise.all([
    once(this.h1server.listen(baseH1URL.port), 'listening'),
    once(this.h2server.listen(baseH2URL.port), 'listening'),
  ]);
  console.log('h1 server listening on', this.h1server.address());
  console.log('h2 server listening on', this.h2server.address());
}

export async function mochaGlobalTeardown() {
  await Promise.all([
    once(this.h1server.close(), 'close'),
    once(this.h2server.close(), 'close'),
  ]);
  console.log('server(s) has been closed');
}
