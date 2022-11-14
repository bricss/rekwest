import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import { setTimeout as setTimeoutPromise } from 'node:timers/promises';
import { ackn } from './ackn.mjs';
import { Cookies } from './cookies.mjs';
import { RequestError } from './errors.mjs';
import { APPLICATION_OCTET_STREAM } from './mediatypes.mjs';
import {
  admix,
  affix,
  dispatch,
  merge,
  mixin,
  preflight,
  redirects,
  sanitize,
  transform,
} from './utils.mjs';

export { constants } from 'node:http2';

export * from './ackn.mjs';
export * from './cookies.mjs';
export * from './errors.mjs';
export * from './file.mjs';
export * from './formdata.mjs';
export * as mediatypes from './mediatypes.mjs';
export * from './utils.mjs';

const {
  HTTP2_HEADER_CONTENT_LENGTH,
  HTTP2_HEADER_CONTENT_TYPE,
  HTTP2_HEADER_LOCATION,
  HTTP2_HEADER_RETRY_AFTER,
  HTTP2_HEADER_SET_COOKIE,
  HTTP2_METHOD_GET,
  HTTP2_METHOD_HEAD,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_MOVED_PERMANENTLY,
  HTTP_STATUS_SEE_OTHER,
  HTTP_STATUS_SERVICE_UNAVAILABLE,
  HTTP_STATUS_TOO_MANY_REQUESTS,
} = http2.constants;

const maxRetryAfter = Symbol('maxRetryAfter');
const maxRetryAfterError = (
  interval,
  options,
) => new RequestError(`Maximum '${ HTTP2_HEADER_RETRY_AFTER }' limit exceeded: ${ interval } ms.`, options);
let defaults = {
  follow: 20,
  get maxRetryAfter() {
    return this[maxRetryAfter] ?? this.timeout;
  },
  set maxRetryAfter(value) {
    this[maxRetryAfter] = value;
  },
  method: HTTP2_METHOD_GET,
  retry: {
    attempts: 0,
    backoffStrategy: 'interval * Math.log(Math.random() * (Math.E * Math.E - Math.E) + Math.E)',
    interval: 1e3,
    retryAfter: true,
    statusCodes: [
      HTTP_STATUS_TOO_MANY_REQUESTS,
      HTTP_STATUS_SERVICE_UNAVAILABLE,
    ],
  },
  timeout: 3e5,
};

export default async function rekwest(...args) {
  let options = sanitize(...args);
  const { url } = options;

  if (!options.redirected) {
    options = merge(rekwest.defaults, options);
  }

  if (options.body && [
    HTTP2_METHOD_GET,
    HTTP2_METHOD_HEAD,
  ].includes(options.method)) {
    throw new TypeError(`Request with ${ HTTP2_METHOD_GET }/${ HTTP2_METHOD_HEAD } method cannot have body.`);
  }

  if (options.follow === 0) {
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

  options = await transform(preflight(options));

  const { cookies, digest, follow, h2, redirect, redirected, thenable } = options;
  const { request } = (url.protocol === 'http:' ? http : https);

  const promise = new Promise((resolve, reject) => {
    let client, req;

    if (h2) {
      client = http2.connect(url.origin, options);
      req = client.request(options.headers, options);
    } else {
      req = request(url, options);
    }

    affix(client, req, options);
    req.once('error', reject);
    req.once('frameError', reject);
    req.once('goaway', reject);
    req.once('response', (res) => {
      let headers;

      if (h2) {
        headers = res;
        res = req;
      } else {
        res.once('error', reject);
      }

      admix(res, headers, options);

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
               ? Cookies.jar.get(url.origin)
               : void 0,
      });

      if (follow && /^3\d{2}$/.test(res.statusCode) && res.headers[HTTP2_HEADER_LOCATION]) {
        if (redirect === redirects.error) {
          return res.emit('error', new RequestError(`Unexpected redirect, redirect mode is set to '${ redirect }'.`));
        }

        if (redirect === redirects.follow) {
          options.url = new URL(res.headers[HTTP2_HEADER_LOCATION], url).href;

          if (res.statusCode !== HTTP_STATUS_SEE_OTHER && options?.body?.pipe?.constructor === Function) {
            return res.emit('error', new RequestError(`Unable to ${ redirect } redirect with streamable body.`));
          }

          options.follow--;

          if (res.statusCode === HTTP_STATUS_SEE_OTHER) {
            Reflect.deleteProperty(options.headers, HTTP2_HEADER_CONTENT_LENGTH);
            options.method = HTTP2_METHOD_GET;
            options.body = null;
          }

          Reflect.set(options, 'redirected', true);

          if (res.statusCode === HTTP_STATUS_MOVED_PERMANENTLY && res.headers[HTTP2_HEADER_RETRY_AFTER]) {
            let interval = res.headers[HTTP2_HEADER_RETRY_AFTER];

            interval = Number(interval) * 1000 || new Date(interval) - Date.now();

            if (interval > options.maxRetryAfter) {
              return res.emit('error', maxRetryAfterError(interval, { cause: mixin(res, options) }));
            }

            return setTimeoutPromise(interval).then(() => rekwest(options.url, options).then(resolve, reject));
          }

          return rekwest(options.url, options).then(resolve, reject);
        }
      }

      if (res.statusCode >= HTTP_STATUS_BAD_REQUEST) {
        return reject(mixin(res, options));
      }

      resolve(mixin(res, options));
    });

    dispatch(options, req);
  });

  try {
    const res = await promise;

    if (digest && !redirected) {
      res.body = await res.body();
    }

    return res;
  } catch (ex) {
    const { maxRetryAfter, retry } = options;

    if (retry?.attempts && retry?.statusCodes.includes(ex.statusCode)) {
      let { interval } = retry;

      if (retry.retryAfter && ex.headers[HTTP2_HEADER_RETRY_AFTER]) {
        interval = ex.headers[HTTP2_HEADER_RETRY_AFTER];
        interval = Number(interval) * 1000 || new Date(interval) - Date.now();
        if (interval > maxRetryAfter) {
          throw maxRetryAfterError(interval, { cause: ex });
        }
      } else {
        interval = new Function('interval', `return Math.ceil(${ retry.backoffStrategy });`)(interval);
      }

      retry.attempts--;
      retry.interval = interval;

      return setTimeoutPromise(interval).then(() => rekwest(url, options));
    }

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
  value(...args) {
    const options = preflight({
      ...merge(rekwest.defaults, {
        headers: { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_OCTET_STREAM },
      }, sanitize(...args)),
      redirect: redirects.manual,
    });

    const { h2, url } = options;
    const { request } = (url.protocol === 'http:' ? http : https);
    let client, req;

    if (h2) {
      client = http2.connect(url.origin, options);
      req = client.request(options.headers, options);
    } else {
      req = request(url, options);
    }

    affix(client, req, options);
    req.once('response', (res) => {
      let headers;

      if (h2) {
        headers = res;
        res = req;
      }

      admix(res, headers, options);
    });

    return req;
  },
});

Reflect.defineProperty(rekwest, 'defaults', {
  enumerable: true,
  get() { return defaults; },
  set(value) { defaults = merge(defaults, value); },
});
