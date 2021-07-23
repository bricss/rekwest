import { request } from 'https';
import { Cookies } from './cookies.mjs';
import { RequestError } from './errors.mjs';
import {
  ackn,
  compress,
  merge,
  preflight,
} from './helpers.mjs';

export * from './cookies.mjs';
export * from './errors.mjs';
export * from './helpers.mjs';

export default async function rekwest(url, opts = {}) {
  const { digest = true, redirected = false, thenable = false } = opts;
  const promise = new Promise((resolve, reject) => {
    opts = preflight({
      digest,
      redirected,
      url,
      ...opts.redirected ? opts : merge(rekwest.defaults, opts),
    });

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
        value: opts.cookies !== false && Cookies.jar.has(opts.url.origin)
               ? Object.fromEntries(Cookies.jar.get(opts.url.origin).entries())
               : void 0,
      });

      if (opts.follow && /^3\d{2}$/.test(res.statusCode) && res.headers.location) {
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
        value: /^2\d{2}$/.test(res.statusCode),
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

    if (!thenable) {
      throw ex;
    } else {
      return ex;
    }
  }
}

Reflect.defineProperty(rekwest, 'stream', {
  enumerable: true,
  value: function (url, opts = {}, cb) {
    opts = preflight({
      url,
      ...merge(rekwest.defaults, { headers: { 'content-type': 'application/octet-stream' } }, opts),
    });

    return request(opts.url, opts, cb);
  },
});

Reflect.set(rekwest, 'defaults', Object.create(null));
