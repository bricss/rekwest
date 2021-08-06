import http2 from 'http2';
import { request } from 'https';
import { ackn } from './ackn.mjs';
import { Cookies } from './cookies.mjs';
import { RequestError } from './errors.mjs';
import {
  compress,
  merge,
  preflight,
  premix,
} from './helpers.mjs';

export { constants } from 'http2';

export * from './ackn.mjs';
export * from './cookies.mjs';
export * from './errors.mjs';
export * from './helpers.mjs';

const {
        HTTP2_HEADER_CONTENT_ENCODING,
        HTTP2_HEADER_CONTENT_LENGTH,
        HTTP2_HEADER_CONTENT_TYPE,
        HTTP2_HEADER_LOCATION,
        HTTP2_HEADER_SET_COOKIE,
        HTTP2_HEADER_STATUS,
        HTTP2_METHOD_GET,
        HTTP2_METHOD_HEAD,
        HTTP_STATUS_BAD_REQUEST,
        HTTP_STATUS_SEE_OTHER,
      } = http2.constants;

export default async function rekwest(url, opts = {}) {
  url = opts.url = new URL(url);
  const { digest = true, method, redirected = false, thenable = false } = opts;
  let { body } = opts;

  if (body?.constructor.name === 'Blob') {
    body = Buffer.from(await body.arrayBuffer());
  }

  if (url.protocol === 'https:') {
    opts = await ackn(opts);
  } else if (Reflect.has(opts, 'alpnProtocol')) {
    [
      'alpnProtocol',
      'createConnection',
      'h2',
      'protocol',
    ].forEach((it) => {
      Reflect.deleteProperty(opts, it);
    });
  }

  const promise = new Promise((resolve, reject) => {
    let client, req;

    opts = preflight({
      digest,
      ...redirected ? opts : merge(rekwest.defaults, opts),
    });

    if (!opts.follow) {
      throw new RequestError(`Maximum redirect reached at: ${ url.href }`);
    }

    if (opts.h2) {
      client = http2.connect(url.origin, opts);
      req = client.request(opts.headers, opts);
    } else {
      req = request(url, opts);
    }

    req.on('response', (res) => {
      const { cookies, follow, h2 = false, redirect } = opts;

      if (h2) {
        const headers = res;

        res = req;

        Reflect.defineProperty(res, 'headers', {
          enumerable: true,
          value: headers,
        });

        Reflect.defineProperty(res, 'httpVersion', {
          enumerable: true,
          value: `${ h2 + 1 }.0`,
        });

        Reflect.defineProperty(res, 'statusCode', {
          enumerable: true,
          value: headers[HTTP2_HEADER_STATUS],
        });
      } else {
        res.on('error', reject);
      }

      if (cookies !== false && res.headers[HTTP2_HEADER_SET_COOKIE]) {
        if (Cookies.jar.has(url.origin)) {
          new Cookies(res.headers[HTTP2_HEADER_SET_COOKIE]).forEach(function (val, key) {
            this.set(key, val);
          }, Cookies.jar.get(url.origin));
        } else {
          Cookies.jar.set(url.origin, new Cookies(res.headers[HTTP2_HEADER_SET_COOKIE]));
        }
      }

      Reflect.defineProperty(res, 'cookies', {
        enumerable: true,
        value: cookies !== false && Cookies.jar.has(url.origin)
               ? Object.fromEntries(Cookies.jar.get(url.origin).entries())
               : void 0,
      });

      if (follow && /^3\d{2}$/.test(res.statusCode) && res.headers[HTTP2_HEADER_LOCATION]) {
        if (redirect === 'error') {
          res.emit('error', new RequestError(`Unexpected redirect, redirect mode is set to ${ redirect }`));
        }

        if (redirect === 'follow') {
          const { body } = opts;

          opts.url = new URL(res.headers[HTTP2_HEADER_LOCATION], url).href;

          if (res.statusCode !== HTTP_STATUS_SEE_OTHER && body === Object(body)
            && Reflect.has(body, 'pipe')
            && body.pipe?.constructor === Function) {
            res.emit('error', new RequestError(`Unable to ${ redirect } redirect with body as readable stream`));
          }

          opts.follow--;

          if (res.statusCode === HTTP_STATUS_SEE_OTHER) {
            Reflect.deleteProperty(opts.headers, HTTP2_HEADER_CONTENT_LENGTH);
            opts.method = HTTP2_METHOD_GET;
            opts.body = null;
          }

          Reflect.set(opts, 'redirected', true);

          return rekwest(opts.url, opts).then(resolve, reject);
        }
      }

      Reflect.defineProperty(res, 'ok', {
        enumerable: true,
        value: /^2\d{2}$/.test(res.statusCode),
      });

      Reflect.defineProperty(res, 'redirected', {
        enumerable: true,
        value: !!opts.redirected,
      });

      if (res.statusCode >= HTTP_STATUS_BAD_REQUEST) {
        return reject(premix(res, opts));
      }

      resolve(premix(res, opts));
    });

    req.on('end', () => {
      client?.close();
    });
    req.on('error', reject);
    req.on('frameError', reject);
    req.on('goaway', reject);
    req.on('timeout', req.destroy);

    if (body) {
      if (method === HTTP2_METHOD_GET || method === HTTP2_METHOD_HEAD) {
        throw new TypeError(`Request with ${ HTTP2_METHOD_GET }/${ HTTP2_METHOD_HEAD } method cannot have body`);
      }

      if (body === Object(body) && Reflect.has(body, 'pipe') && body.pipe?.constructor === Function) {
        body.pipe(req);
      } else {
        if (body.constructor === URLSearchParams) {
          const headers = { [HTTP2_HEADER_CONTENT_TYPE]: 'application/x-www-form-urlencoded' };

          req.respond?.(headers);
          req.setHeader?.(HTTP2_HEADER_CONTENT_TYPE, headers[HTTP2_HEADER_CONTENT_TYPE]);
          body = body.toString();
        } else if (body === Object(body) && !Buffer.isBuffer(body)) {
          const headers = { [HTTP2_HEADER_CONTENT_TYPE]: 'application/json' };

          req.respond?.(headers);
          req.setHeader?.(HTTP2_HEADER_CONTENT_TYPE, headers[HTTP2_HEADER_CONTENT_TYPE]);
          body = JSON.stringify(body);
        }

        if (opts.headers[HTTP2_HEADER_CONTENT_ENCODING]) {
          body = compress(Buffer.from(body), opts.headers[HTTP2_HEADER_CONTENT_ENCODING]);
        }

        const headers = { [HTTP2_HEADER_CONTENT_LENGTH]: Buffer.byteLength(body) };

        req.respond?.(headers);
        req.setHeader?.(HTTP2_HEADER_CONTENT_LENGTH, headers[HTTP2_HEADER_CONTENT_LENGTH]);
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
  value: function (url, opts = {}) {
    opts = preflight({
      url,
      ...merge(rekwest.defaults, { headers: { [HTTP2_HEADER_CONTENT_TYPE]: 'application/octet-stream' } }, opts),
    });

    if (opts.h2) {
      const client = http2.connect(url.origin, opts);
      const req = client.request(opts.headers, opts);

      req.on('end', () => {
        client.close();
      });

      return req;
    }

    return request(opts.url, opts);
  },
});

Reflect.defineProperty(rekwest, 'defaults', {
  enumerable: true,
  value: Object.create(null),
});
