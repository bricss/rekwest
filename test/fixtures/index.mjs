import { once } from 'events';
import { createServer } from 'http';

const baseURL = new URL('http://localhost:3000');

export async function mochaGlobalSetup() {
  this.server = createServer((req, res) => {
    const { pathname } = new URL(req.url, baseURL);

    if (pathname.match(String.raw`/gimme/cookies`) && req.method === 'GET') {
      res.writeHead(200, [
        [
          'content-type',
          'application/json; charset=utf-8',
        ],
        [
          'set-cookie',
          'foo=bar; HttpOnly',
        ],
        [
          'set-cookie',
          'qux=zap; Path=/',
        ],
      ]);
      res.write(JSON.stringify({
        here: { is: 'cookies' },
      }));
    } else if (pathname.match(String.raw`/gimme/json`) && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write(JSON.stringify({
        here: { is: 'json' },
      }));
    } else if (pathname.match(String.raw`/gimme/nothing`) && req.method === 'GET') {
      res.statusCode = 204;
    } else if (pathname.match(String.raw`/gimme/redirect`) && req.method === 'GET') {
      res.writeHead(301, {
        'location': '/gimme/json',
        'set-cookie': 'crack=duck; SameSite=Lax',
      });
    } else if (pathname.match(String.raw`/gimme/redirect`) && req.method === 'POST') {
      res.writeHead(302, {
        'location': '/gimme/void',
      });
    } else if (pathname.match(String.raw`/gimme/redirect`) && req.method === 'PUT') {
      res.writeHead(303, {
        'location': '/gimme/json',
      });
    } else if (pathname.match(String.raw`/gimme/refusal`) && req.method === 'GET') {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.write(JSON.stringify({
        message: 'unauthorized',
      }));
    } else if (pathname.match(String.raw`/gimme/text`) && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.write('here is text');
    } else {
      res.statusCode = 404;
    }

    res.end();
  });

  await once(this.server.listen(baseURL.port), 'listening');
  console.log('server listening on', this.server.address());
}

export async function mochaGlobalTeardown() {
  await once(this.server.close(), 'close');
  console.log('server has been closed');
}
