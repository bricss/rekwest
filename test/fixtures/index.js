import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import routes from './routes.js';

const http1BaseURL = new URL('http://localhost:1081');
const http2BaseURL = new URL('http://localhost:3000');
const https1BaseURL = new URL('https://localhost:1083');
const https2BaseURL = new URL('https://localhost:3443');

Object.assign(globalThis, {
  http1BaseURL, http2BaseURL, https1BaseURL, https2BaseURL,
});

export async function mochaGlobalSetup() {
  const cwd = process.cwd();
  const cert = readFileSync(`${ cwd }/localhost.cert`);
  const key = readFileSync(`${ cwd }/localhost.key`);

  this.http1Server = http.createServer(routes(http1BaseURL));
  this.http2Server = http2.createServer(routes(http2BaseURL));
  this.https1Server = https.createServer({ cert, key }, routes(https1BaseURL));
  this.https2Server = http2.createSecureServer({ cert, key }, routes(https2BaseURL));

  await Promise.all([
    once(this.http1Server.listen(http1BaseURL.port), 'listening'),
    once(this.http2Server.listen(http2BaseURL.port), 'listening'),
    once(this.https1Server.listen(https1BaseURL.port), 'listening'),
    once(this.https2Server.listen(https2BaseURL.port), 'listening'),
  ]);
  console.log('http1 server listening on:', this.http1Server.address());
  console.log('http2 server listening on:', this.http2Server.address());
  console.log('https1 server listening on:', this.https1Server.address());
  console.log('https2 server listening on:', this.https2Server.address());
}

export async function mochaGlobalTeardown() {
  await Promise.all([
    once(this.http1Server.close(), 'close'),
    once(this.http2Server.close(), 'close'),
    once(this.https1Server.close(), 'close'),
    once(this.https2Server.close(), 'close'),
  ]);
  console.log('server(s) has been closed.');
}
