import { globalAgent } from 'http';
import { request } from 'https';
import { Cookies } from './cookies.mjs';
import { RequestError } from './errors.mjs';
import {
  ackn,
  compress,
} from './helpers.mjs';

export * from './cookies.mjs';
export * from './errors.mjs';

export default async function rekwest(url, opts = {}) {
  const { digest = true, redirected = false } = opts;
  const promise = new Promise((resolve, reject) => {
    opts.url = new URL(url);
    opts.agent ??= opts.url.protocol === 'http:' ? globalAgent : void 0;
    if (opts.cookies !== false) {
      let cookie = Cookies.jar.get(opts.url.origin);

      if (opts.cookies === Object(opts.cookies) && !opts.redirected) {
        if (cookie) {
          new Cookies(opts.cookies).forEach(function (val, key) {
            this.set(key, val);
          }, cookie);
        } else {
          cookie = new Cookies(opts.cookies);
          Cookies.jar.set(opts.url.origin, cookie);
        }
      }

      opts.headers = {
        ...cookie ? { cookie } : null,
        ...opts.headers,
      };
    }

    opts.follow ??= 20;
    opts.headers = {
      'accept': 'application/json, text/plain, */*',
      'accept-encoding': 'br, deflate, gzip',
      ...Object.entries(opts.headers || {})
               .reduce((acc, [key, val]) => (acc[key.toLowerCase()] = val, acc), {}),
    };
    opts.parse ??= true;
    opts.redirect ??= 'follow';

    if (!opts.follow) {
      throw new RequestError(`Maximum redirect reached at: ${ opts.url.href }`);
    }

    const req = request(opts.url, opts, (res) => {
      res.on('error', reject);

      if (opts.cookies !== false && res.headers['set-cookie']) {
        if (Cookies.jar.has(opts.url.origin)) {
          new Cookies(res.headers['set-cookie']).forEach(function (val, key) {
            this.set(key, val);
          }, Cookies.jar.get(opts.url.origin));
        } else {
          Cookies.jar.set(opts.url.origin, new Cookies(res.headers['set-cookie']));
        }
      }

      Reflect.defineProperty(res, 'cookies', {
        enumerable: true,
        value: Cookies.jar.has(opts.url.origin)
               ? Object.fromEntries(Cookies.jar.get(opts.url.origin).entries())
               : void 0,
      });

      if (opts.follow && /3\d{2}/.test(res.statusCode) && res.headers.location) {
        if (opts.redirect === 'error') {
          res.emit('error', new RequestError('Unexpected redirect, redirect mode is set to error.'));
        }

        if (opts.redirect === 'follow') {
          const { body } = opts;

          opts.url = new URL(res.headers.location, opts.url).href;

          if (res.statusCode !== 303 && body === Object(body)
            && Reflect.has(body, 'pipe')
            && body.pipe?.constructor === Function) {
            res.emit('error', new RequestError('Unable to follow redirect with body as readable stream.'));
          }

          opts.follow -= 1;
          if (res.statusCode === 303) {
            Reflect.deleteProperty(opts.headers, 'content-length');
            opts.method = 'GET';
            opts.body = null;
          }

          Reflect.set(opts, 'redirected', true);

          return rekwest(opts.url, opts).then(resolve, reject);
        }
      }

      Reflect.defineProperty(res, 'ok', {
        configurable: true,
        enumerable: true,
        value: /2\d{2}/.test(res.statusCode),
      });

      Reflect.defineProperty(res, 'redirected', {
        enumerable: true,
        value: !!opts.redirected,
      });

      if (res.statusCode >= 400) {
        return reject(ackn(res, opts));
      }

      resolve(ackn(res, opts));
    });

    req.on('error', reject);
    req.on('timeout', req.destroy);

    if (opts.body) {
      let { body } = opts;

      if (body === Object(body) && Reflect.has(body, 'pipe') && body.pipe?.constructor === Function) {
        body.pipe(req);
      } else {
        if (body === Object(body) && !Buffer.isBuffer(body)) {
          req.setHeader('content-type', 'application/json');
          body = JSON.stringify(body);
          req.setHeader('content-length', Buffer.byteLength(body));
        }

        if (opts.headers['content-encoding']) {
          body = compress(Buffer.from(body), opts.headers['content-encoding']);
          req.setHeader('content-length', Buffer.byteLength(body));
        }

        req.write(body);
        req.end();
      }
    } else {
      req.end();
    }
  });

  try {
    const res = await promise;

    if (digest && !redirected) {
      res.body = await res.body();
    }

    return res;
  } catch (ex) {
    if (digest && !redirected && ex.body) {
      ex.body = await ex.body();
    }

    throw ex;
  }
}

Reflect.defineProperty(rekwest, 'stream', {
  enumerable: true,
  value: function (url, opts = {}, cb) {
    opts.url = new URL(url);
    opts.agent ??= opts.url.protocol === 'http:' ? globalAgent : void 0;
    opts.headers = { 'content-type': 'application/octet-stream', ...opts.headers };

    return request(opts.url, opts, cb);
  },
});
