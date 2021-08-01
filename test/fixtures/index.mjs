import { once } from 'events';
import { createServer } from 'http';
import {
  PassThrough,
  Transform,
} from 'stream';
import zlib from 'zlib';

const baseURL = new URL('http://localhost:3000');

export async function mochaGlobalSetup() {
  this.server = createServer((req, res) => {
    const { pathname } = new URL(req.url, baseURL);

    res.statusCode = 404;
    if (pathname.match(String.raw`/gimme/cookies`) && /get/i.test(req.method)) {
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
        gotta: 'cookies',
      }));
      res.end();
    } else if (pathname.match(String.raw`/gimme/encode`) && /get/i.test(req.method)) {
      const charset = 'utf-16be';

      res.writeHead(200, { 'content-type': `text/plain; charset=${ charset }` });
      res.write(new TextEncoder(charset).encode('gotta text'));
      res.end();
    } else if (pathname.match(String.raw`/gimme/json`) && /get/i.test(req.method)) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write(JSON.stringify({
        gotta: 'json',
      }));
      res.end();
    } else if (pathname.match(String.raw`/gimme/kaboom`) && /get/i.test(req.method)) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.write(JSON.stringify({
        message: 'kaboom',
      }));
      res.end();
    } else if (pathname.match(String.raw`/gimme/nothing`) && /get/i.test(req.method)) {
      res.statusCode = 204;
      res.end();
    } else if (pathname.match(String.raw`/gimme/redirect`) && /get/i.test(req.method)) {
      res.writeHead(301, {
        'location': '/gimme/json',
        'set-cookie': 'crack=duck; SameSite=Lax',
      });
      res.end();
    } else if (pathname.match(String.raw`/gimme/redirect`) && /post/i.test(req.method)) {
      res.writeHead(302, {
        'location': '/gimme/void',
      });
      res.end();
    } else if (pathname.match(String.raw`/gimme/redirect`) && /put/i.test(req.method)) {
      res.writeHead(303, {
        'location': '/gimme/json',
      });
      res.end();
    } else if (pathname.match(String.raw`/gimme/refusal`) && /get/i.test(req.method)) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.write(JSON.stringify({
        message: 'unauthorized',
      }));
      res.end();
    } else if (pathname.match(String.raw`/gimme/repulse`) && /post/i.test(req.method)) {
      res.statusCode = 200;
      req.pipe(res);
    } else if (pathname.match(String.raw`/gimme/squash`) && /post/i.test(req.method)) {
      const compressor = {
        br: zlib.createBrotliCompress,
        deflate: zlib.createDeflate,
        gzip: zlib.createGzip,
      }[req.headers['content-encoding']] ?? PassThrough;
      const decompressor = {
        br: zlib.createBrotliDecompress,
        deflate: zlib.createInflate,
        gzip: zlib.createUnzip,
      }[req.headers['content-encoding']] ?? PassThrough;

      res.writeHead(200, {
        'content-encoding': req.headers['content-encoding'] ?? 'utf-8',
        'content-type': 'text/plain',
      });
      req.pipe(decompressor()).setEncoding('utf8')
         .pipe(new Transform({
           construct(cb) {
             this.data = '';
             cb();
           },
           decodeStrings: false,
           flush(cb) {
             try {
               this.push(this.data.split('').reverse().join(''));
             } catch (ex) {
               cb(ex);
             } finally {
               cb();
             }
           },
           transform(chunk, encoding, cb) {
             this.data += chunk;
             cb();
           },
         })).pipe(compressor()).pipe(res);
    } else if (pathname.match(String.raw`/gimme/text`) && /get/i.test(req.method)) {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.write('gotta text');
      res.end();
    } else {
      res.end();
    }
  });

  await once(this.server.listen(baseURL.port), 'listening');
  console.log('server listening on', this.server.address());
}

export async function mochaGlobalTeardown() {
  await once(this.server.close(), 'close');
  console.log('server has been closed');
}
