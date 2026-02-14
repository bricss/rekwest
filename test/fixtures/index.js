import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import routes from './routes.js';

const h1cBaseURL = new URL('http://localhost:1081');
const h1sBaseURL = new URL('https://localhost:1083');
const h2cBaseURL = new URL('http://localhost:2000');
const h2sBaseURL = new URL('https://localhost:2443');

Object.assign(globalThis, {
  h1cBaseURL,
  h1sBaseURL,
  h2cBaseURL,
  h2sBaseURL,
});

export async function mochaGlobalSetup() {
  const cwd = process.cwd();
  const cert = readFileSync(`${ cwd }/localhost.cert`);
  const key = readFileSync(`${ cwd }/localhost.key`);

  this.h1cServer = http.createServer(routes(h1cBaseURL));
  this.h1sServer = https.createServer({ cert, key }, routes(h1sBaseURL));
  this.h2cServer = http2.createServer(routes(h2cBaseURL));
  this.h2sServer = http2.createSecureServer({ cert, key }, routes(h2sBaseURL));

  await Promise.all([
    once(this.h1cServer.listen(h1cBaseURL.port), 'listening'),
    once(this.h1sServer.listen(h1sBaseURL.port), 'listening'),
    once(this.h2cServer.listen(h2cBaseURL.port), 'listening'),
    once(this.h2sServer.listen(h2sBaseURL.port), 'listening'),
  ]);
  console.log('h1c server listening on', this.h1cServer.address());
  console.log('h1s server listening on', this.h1sServer.address());
  console.log('h2c server listening on', this.h2cServer.address());
  console.log('h2s server listening on', this.h2sServer.address());
}

export async function mochaGlobalTeardown() {
  await Promise.all([
    once(this.h1cServer.close(), 'close'),
    once(this.h2cServer.close(), 'close'),
    once(this.h1sServer.close(), 'close'),
    once(this.h2sServer.close(), 'close'),
  ]);
  console.log('server(s) has been closed');
}
