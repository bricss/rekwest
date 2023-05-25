import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import {
  pipeline,
  Readable,
} from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { setTimeout as setTimeoutPromise } from 'node:timers/promises';
import { types } from 'node:util';
import zlib from 'node:zlib';
import { ackn } from './ackn.mjs';
import defaults from './defaults.mjs';
import {
  RequestError,
  TimeoutError,
} from './errors.mjs';
import { File } from './file.mjs';
import { FormData } from './formdata.mjs';
import {
  APPLICATION_FORM_URLENCODED,
  APPLICATION_JSON,
  APPLICATION_OCTET_STREAM,
} from './mediatypes.mjs';
import { postflight } from './postflight.mjs';
import { preflight } from './preflight.mjs';

const {
  HTTP2_HEADER_CONTENT_ENCODING,
  HTTP2_HEADER_CONTENT_LENGTH,
  HTTP2_HEADER_CONTENT_TYPE,
  HTTP2_HEADER_RETRY_AFTER,
  HTTP2_HEADER_STATUS,
} = http2.constants;

export const admix = (res, headers, options) => {
  const { h2 } = options;

  if (h2) {
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
  }

  Reflect.defineProperty(res, 'ok', {
    enumerable: true,
    value: /^2\d{2}$/.test(res.statusCode),
  });

  Reflect.defineProperty(res, 'redirected', {
    enumerable: true,
    value: !!options.redirected,
  });
};

export const affix = (client, req, options) => {
  req.once('end', () => client?.close());
  req.once('timeout', () => req.destroy(new TimeoutError(`Timed out after ${ options.timeout } ms.`)));
  req.once('trailers', (trailers) => {
    Reflect.defineProperty(req, 'trailers', {
      enumerable: true,
      value: trailers,
    });
  });
};

export const brandCheck = (value, ctor) => {
  if (!(value instanceof ctor)) {
    throw new TypeError('Illegal invocation');
  }
};

export const compress = (readable, encodings = '') => {
  const encoders = [];

  encodings = unwind(encodings);

  for (const encoding of encodings) {
    if (/\bbr\b/i.test(encoding)) {
      encoders.push(zlib.createBrotliCompress());
    } else if (/\bdeflate(?!-(?:\w+)?)\b/i.test(encoding)) {
      encoders.push(zlib.createDeflate());
    } else if (/\bdeflate-raw\b/i.test(encoding)) {
      encoders.push(zlib.createDeflateRaw());
    } else if (/\bgzip\b/i.test(encoding)) {
      encoders.push(zlib.createGzip());
    } else {
      return readable;
    }
  }

  return pipeline(readable, ...encoders, () => void 0);
};

export const decompress = (readable, encodings = '') => {
  const decoders = [];

  encodings = unwind(encodings);

  for (const encoding of encodings) {
    if (/\bbr\b/i.test(encoding)) {
      decoders.push(zlib.createBrotliDecompress());
    } else if (/\bdeflate(?!-(?:\w+)?)\b/i.test(encoding)) {
      decoders.push(zlib.createInflate());
    } else if (/\bdeflate-raw\b/i.test(encoding)) {
      decoders.push(zlib.createInflateRaw());
    } else if (/\bgzip\b/i.test(encoding)) {
      decoders.push(zlib.createGunzip());
    } else {
      return readable;
    }
  }

  return pipeline(readable, ...decoders, () => void 0);
};

export const dispatch = ({ body }, req) => {
  if (body?.pipe?.constructor === Function) {
    body.pipe(req);
  } else {
    req.end(body);
  }
};

export const maxRetryAfter = Symbol('maxRetryAfter');

export const maxRetryAfterError = (
  interval,
  options,
) => new RequestError(`Maximum '${ HTTP2_HEADER_RETRY_AFTER }' limit exceeded: ${ interval } ms.`, options);

export const merge = (target = {}, ...rest) => {
  target = JSON.parse(JSON.stringify(target));
  if (!rest.length) {
    return target;
  }

  rest.filter((it) => it === Object(it)).forEach((it) => {
    Object.entries(it).reduce((acc, [key, val]) => {
      if ([
        acc[key]?.constructor,
        val?.constructor,
      ].every((it) => [
        Array,
        Object,
      ].includes(it))) {
        if (acc[key]?.constructor === val.constructor) {
          acc[key] = merge(acc[key], val);
        } else {
          acc[key] = val;
        }
      } else {
        acc[key] = val;
      }

      return acc;
    }, target);
  });

  return target;
};

export const normalize = (url, options = {}) => {
  if (!options.redirected) {
    options = merge(defaults.stash, options);
  }

  if (options.trimTrailingSlashes) {
    url = `${ url }`.replace(/(?<!:)\/+/g, '/');
  }

  url = new URL(url, options.baseURL);

  return Object.assign(options, { url });
};

export const sameOrigin = (a, b) => a.protocol === b.protocol && a.hostname === b.hostname && a.port === b.port;

export async function* tap(value) {
  if (Reflect.has(value, Symbol.asyncIterator)) {
    yield* value;
  } else if (value.stream) {
    yield* value.stream();
  } else {
    yield await value.arrayBuffer();
  }
}

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
    [
      'alpnProtocol',
      'createConnection',
      'h2',
      'protocol',
    ].forEach((it) => Reflect.deleteProperty(options, it));
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

export const transform = async (options) => {
  let { body, headers } = options;

  if (!body) {
    return options;
  }

  if (File.alike(body)) {
    headers = {
      [HTTP2_HEADER_CONTENT_LENGTH]: body.size,
      [HTTP2_HEADER_CONTENT_TYPE]: body.type || APPLICATION_OCTET_STREAM,
    };
    body = body.stream();
  } else if (FormData.alike(body)) {
    body = FormData.actuate(body);
    headers = { [HTTP2_HEADER_CONTENT_TYPE]: body.contentType };
  } else if (!Buffer.isBuffer(body)) {
    if (types.isAnyArrayBuffer(body)) {
      body = Buffer.from(body);
    } else if (types.isArrayBufferView(body)) {
      body = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
    } else if (body === Object(body) && !Reflect.has(body, Symbol.asyncIterator)) {
      if (body.constructor === URLSearchParams) {
        headers = { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_FORM_URLENCODED };
        body = body.toString();
      } else if (!(!Array.isArray(body) && Reflect.has(body, Symbol.iterator))) {
        headers = { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_JSON };
        body = JSON.stringify(body);
      }
    }
  }

  const encodings = options.headers[HTTP2_HEADER_CONTENT_ENCODING];

  if (body === Object(body)
    && (Reflect.has(body, Symbol.asyncIterator) || (!Array.isArray(body) && Reflect.has(body, Symbol.iterator)))) {
    body = encodings ? compress(Readable.from(body), encodings) : Readable.from(body);
  } else if (encodings) {
    body = await buffer(compress(Readable.from(body), encodings));
  }

  Object.assign(options.headers, {
    ...headers,
    ...!body[Symbol.asyncIterator] && {
      [HTTP2_HEADER_CONTENT_LENGTH]: Buffer.byteLength(body),
    },
    ...options.headers[HTTP2_HEADER_CONTENT_TYPE] && {
      [HTTP2_HEADER_CONTENT_TYPE]: options.headers[HTTP2_HEADER_CONTENT_TYPE],
    },
  });

  return {
    ...options,
    body,
  };
};

export const unwind = (encodings) => encodings.split(',').map((it) => it.trim());
