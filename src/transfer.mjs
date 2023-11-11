import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import { setTimeout as setTimeoutPromise } from 'node:timers/promises';
import { ackn } from './ackn.mjs';
import { RequestError } from './errors.mjs';
import { postflight } from './postflight.mjs';
import { preflight } from './preflight.mjs';
import { transform } from './transform.mjs';
import {
  affix,
  dispatch,
  maxRetryAfterError,
} from './utils.mjs';

const {
  HTTP2_HEADER_RETRY_AFTER,
} = http2.constants;

export const transfer = async (options, overact) => {
  const { digest, redirected, thenable, url } = options;

  if (options.follow === 0) {
    throw new RequestError(`Maximum redirect reached at: ${ url.href }`);
  }

  if (url.protocol === 'https:') {
    options = !options.h2 ? await ackn(options) : {
      ...options,
      createConnection: null,
      protocol: url.protocol,
    };
  } else if (Reflect.has(options, 'alpnProtocol')) {
    for (const it of [
      'alpnProtocol',
      'createConnection',
      'h2',
      'protocol',
    ]) { Reflect.deleteProperty(options, it); }
  }

  try {
    options = await transform(preflight(options));
  } catch (ex) {
    options.createConnection?.().destroy();
    throw ex;
  }

  const promise = new Promise((resolve, reject) => {
    let client, req;

    if (options.h2) {
      client = http2.connect(url.origin, options);
      req = client.request(options.headers, options);
    } else {
      const { request } = url.protocol === 'http:' ? http : https;

      req = request(url, options);
    }

    affix(client, req, options);

    req.once('error', reject);
    req.once('frameError', reject);
    req.once('goaway', reject);
    req.once('response', (res) => postflight(req, res, options, {
      reject,
      resolve,
    }));

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

      return setTimeoutPromise(interval).then(() => overact(url, options));
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
};
