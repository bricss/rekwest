import {
  Blob,
  File,
} from 'node:buffer';
import http2 from 'node:http2';
import { pipeline } from 'node:stream';
import zlib from 'node:zlib';
import defaults from './defaults.mjs';
import {
  RequestError,
  TimeoutError,
} from './errors.mjs';

const {
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
  req.once('close', () => client?.close());
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

export const copyWithMerge = (target, ...rest) => {
  target = structuredClone(target);
  if (!rest.length) {
    return target;
  }

  return merge(target, ...rest);
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

export const isFileLike = (instance) => {
  return [
    Blob.name,
    File.name,
  ].includes(instance?.[Symbol.toStringTag]);
};

export const isReadableStream = (instance) => {
  return ReadableStream.name === instance?.[Symbol.toStringTag];
};

export const maxRetryAfter = Symbol('maxRetryAfter');

export const maxRetryAfterError = (
  interval,
  options,
) => new RequestError(`Maximum '${ HTTP2_HEADER_RETRY_AFTER }' limit exceeded: ${ interval } ms.`, options);

export const merge = (target, ...rest) => {
  rest = rest.filter((it) => it === Object(it));
  for (const source of rest) {
    for (const key of Object.getOwnPropertyNames(source)) {
      const sv = source[key];
      const tv = target[key];

      if (Object(sv) === sv && Object(tv) === tv) {
        target[key] = merge(tv, sv);
        continue;
      }

      target[key] = source[key];
    }
  }

  return target;
};

export const normalize = (url, options = {}) => {
  if (!options.redirected) {
    options = copyWithMerge(defaults.stash, options);
  }

  if (options.trimTrailingSlashes) {
    url = `${ url }`.replace(/(?<!:)\/+/g, '/');
  }

  if (options.stripTrailingSlash) {
    url = `${ url }`.replace(/\/$|\/(?=#)|\/(?=\?)/g, '');
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

export const toCamelCase = (str) => str?.toLowerCase().replace(
  /\p{Punctuation}.|\p{White_Space}./gu,
  (val) => val.replace(/\p{Punctuation}+|\p{White_Space}+/gu, '').toUpperCase(),
);

export const unwind = (encodings) => encodings.split(',').map((it) => it.trim());
