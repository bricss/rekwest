import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import { ackn } from './ackn.js';
import { RequestError } from './errors.js';
import { postflight } from './postflight.js';
import { preflight } from './preflight.js';
import { retries } from './retries.js';
import { transform } from './transform.js';
import {
  deepMerge,
  dispatch,
  isLikelyH2cPrefaceError,
  snoop,
} from './utils.js';

export const transfer = async (options) => {
  const { digest, redirected, thenable, url } = options;

  if (options.follow === 0) {
    throw new RequestError(`Maximum redirect reached at: ${ url.href }`);
  }

  if (url.protocol === 'https:') {
    options = !options.h2 ? await ackn(options) : {
      ...options, createConnection: null, protocol: url.protocol,
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
  } catch (err) {
    options.createConnection?.().destroy();
    throw err;
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

    snoop(client, req, options);

    req.once('aborted', reject);
    req.once('error', reject);
    req.once('frameError', reject);
    req.once('goaway', reject);
    req.once('response', (res) => postflight(req, res, options, {
      reject, resolve,
    }));

    dispatch(req, options);
  });

  try {
    const res = await promise;

    if (digest && !redirected) {
      res.body = await res.body();
    }

    return res;
  } catch (err) {
    if (isLikelyH2cPrefaceError(err)) {
      options = deepMerge(options, {
        h2: true,
        retry: {
          attempts: 1,
          errorCodes: [err.code],
          interval: 0,
        },
      });
    }

    const result = retries(err, options);

    if (result) {
      return result;
    }

    if (digest && !redirected && err.body) {
      err.body = await err.body();
    }

    if (!thenable) {
      throw err;
    } else {
      return err;
    }
  }
};
