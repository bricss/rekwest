import http2 from 'http2';
import { request } from 'https';
import { ackn } from './ackn.mjs';
import { Cookies } from './cookies.mjs';
import { RequestError } from './errors.mjs';
import {
  dispatch,
  merge,
  preflight,
  premix,
  transform,
} from './helpers.mjs';
import { APPLICATION_OCTET_STREAM } from './mediatypes.mjs';

export { constants } from 'http2';

export * from './ackn.mjs';
export * from './cookies.mjs';
export * from './errors.mjs';
export * from './file.mjs';
export * from './formdata.mjs';
export * from './helpers.mjs';

const {
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

export default async function rekwest(url, options = {}) {
  url = options.url = new URL(url);
  if (!options.redirected) {
    options = merge(rekwest.defaults, { follow: 20, method: HTTP2_METHOD_GET }, options);
  }

  if (options.body && [
    HTTP2_METHOD_GET,
    HTTP2_METHOD_HEAD,
  ].includes(options.method)) {
    throw new TypeError(`Request with ${ HTTP2_METHOD_GET }/${ HTTP2_METHOD_HEAD } method cannot have body`);
  }

  if (!options.follow) {
    throw new RequestError(`Maximum redirect reached at: ${ url.href }`);
  }

  if (url.protocol === 'https:') {
    options = await ackn(options);
  } else if (Reflect.has(options, 'alpnProtocol')) {
    [
      'alpnProtocol',
      'createConnection',
      'h2',
      'protocol',
    ].forEach((it) => Reflect.deleteProperty(options, it));
  }

  options = preflight(options);

  const { cookies, digest, follow, h2, redirect, redirected, thenable } = options;
  let { body } = options;

  const promise = new Promise((resolve, reject) => {
    let client, req;

    body &&= transform(body, options);

    if (h2) {
      client = http2.connect(url.origin, options);
      req = client.request(options.headers, options);
    } else {
      req = request(url, options);
    }

    req.on('response', (res) => {
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
          res.emit('error', new RequestError(`Unexpected redirect, redirect mode is set to '${ redirect }'`));
        }

        if (redirect === 'follow') {
          options.url = new URL(res.headers[HTTP2_HEADER_LOCATION], url).href;

          if (res.statusCode !== HTTP_STATUS_SEE_OTHER
            && body === Object(body) && body.pipe?.constructor === Function) {
            res.emit('error', new RequestError(`Unable to ${ redirect } redirect with body as readable stream`));
          }

          options.follow--;

          if (res.statusCode === HTTP_STATUS_SEE_OTHER) {
            Reflect.deleteProperty(options.headers, HTTP2_HEADER_CONTENT_LENGTH);
            options.method = HTTP2_METHOD_GET;
            options.body = null;
          }

          Reflect.set(options, 'redirected', true);

          return rekwest(options.url, options).then(resolve, reject);
        }
      }

      Reflect.defineProperty(res, 'ok', {
        enumerable: true,
        value: /^2\d{2}$/.test(res.statusCode),
      });

      Reflect.defineProperty(res, 'redirected', {
        enumerable: true,
        value: options.redirected,
      });

      if (res.statusCode >= HTTP_STATUS_BAD_REQUEST) {
        return reject(premix(res, options));
      }

      resolve(premix(res, options));
    });

    req.on('end', () => {
      client?.close();
    });
    req.on('error', reject);
    req.on('frameError', reject);
    req.on('goaway', reject);
    req.on('timeout', req.destroy);

    dispatch(req, { ...options, body });
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
  value: function (url, options = {}) {
    options = preflight({
      url,
      ...merge(rekwest.defaults, {
        headers: { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_OCTET_STREAM },
      }, options),
    });

    if (options.h2) {
      const client = http2.connect(url.origin, options);
      const req = client.request(options.headers, options);

      req.on('end', () => {
        client.close();
      });

      return req;
    }

    return request(options.url, options);
  },
});

Reflect.defineProperty(rekwest, 'defaults', {
  enumerable: true,
  value: Object.create(null),
  writable: true,
});
