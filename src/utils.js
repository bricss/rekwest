import {
  Blob,
  File,
} from 'node:buffer';
import http2 from 'node:http2';
import {
  isReadable,
  Readable,
} from 'node:stream';
import config, { isZstdSupported } from './config.js';
import { TimeoutError } from './errors.js';

const {
  HTTP2_HEADER_ACCEPT_ENCODING,
  HTTP2_HEADER_STATUS,
} = http2.constants;

export const addSearchParams = (url, params = {}) => {
  for (const [key, val] of Object.entries(params)) {
    if (Array.isArray(val)) {
      for (const v of val) {
        url.searchParams.append(key, v);
      }
    } else {
      url.searchParams.set(key, val);
    }
  }

  return url;
};

export const augment = (res, headers, options) => {
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

export const brandCheck = (val, ctor) => {
  if (!(val instanceof ctor)) {
    throw new TypeError('Illegal invocation');
  }
};

export const cloneWith = (target, ...rest) => {
  target = structuredClone(target);
  if (!rest.length) {
    return target;
  }

  return deepMerge(target, ...rest);
};

export const deepMerge = (target, ...rest) => {
  rest = rest.filter((it) => Object(it) === it);
  for (const source of rest) {
    for (const key of Object.getOwnPropertyNames(source)) {
      const sv = source[key];
      const tv = target[key];

      if (Object(sv) === sv && Object(tv) === tv) {
        target[key] = deepMerge(tv, sv);
        continue;
      }

      target[key] = source[key];
    }
  }

  return target;
};

export const dispatch = (req, { body }) => {
  if (isReadable(body)) {
    body.pipe(req);
  } else {
    req.end(body);
  }
};

export const isFileLike = (val) => {
  return [
    Blob,
    File,
  ].some((it) => val instanceof it);
};

export const isLikelyH2cPrefaceError = (err) => {
  return err.code === 'HPE_INVALID_CONSTANT';
};

export const isPipeStream = (val) => {
  return val instanceof Readable;
};

export const isReadableStream = (val) => {
  return val instanceof ReadableStream;
};

export const normalize = (url, options = {}) => {
  if (!options.redirected) {
    options = cloneWith(config.defaults, options);
  }

  if (options.trimTrailingSlashes) {
    url = `${ url }`.replace(/(?<!:)\/+/g, '/');
  }

  if (options.stripTrailingSlash) {
    url = `${ url }`.replace(/\/$|\/(?=#)|\/(?=\?)/g, '');
  }

  return Object.assign(options, {
    headers: normalizeHeaders(options.headers),
    method: options.method.toUpperCase(),
    url: addSearchParams(new URL(url, options.baseURL), options.params),
  });
};

export const normalizeHeaders = (headers = {}) => {
  const acc = {};

  for (const [key, val] of Object.entries(headers)) {
    const name = key.toLowerCase();

    acc[key] = val;

    if (key === HTTP2_HEADER_ACCEPT_ENCODING && !isZstdSupported) {
      const modified = val.replace(/\s?zstd,?/gi, '').trim();

      if (modified) {
        acc[key] = modified;
      } else {
        Reflect.deleteProperty(acc, name);
      }
    }
  }

  return acc;
};

export const sameOrigin = (a, b) => a.protocol === b.protocol && a.hostname === b.hostname && a.port === b.port;

export const snoop = (client, req, options) => {
  req.once('close', () => client?.close());
  req.once('end', () => client?.close());
  req.once('timeout', () => req.destroy(new TimeoutError(`Timed out after ${ options.timeout } ms`)));
  req.once('trailers', (trailers) => {
    Reflect.defineProperty(req, 'trailers', {
      enumerable: true,
      value: trailers,
    });
  });
};

export const stripHeaders = (headers = {}, names = []) => {
  names = new Set(names);

  return Object.fromEntries(
    Object.entries(headers).filter(
      ([key]) => !names.has(key.toLowerCase()),
    ),
  );
};

export async function* tap(val) {
  if (Reflect.has(val, Symbol.asyncIterator)) {
    yield* val;
  } else if (val.stream) {
    yield* val.stream();
  } else {
    yield await val.arrayBuffer();
  }
}

export const toCamelCase = (str) => str?.toLowerCase().replace(
  /\p{Punctuation}.|\p{White_Space}./gu,
  (val) => val.replace(/\p{Punctuation}+|\p{White_Space}+/gu, '').toUpperCase(),
);

export const unwind = (encodings) => encodings.split(',').map((it) => it.toLowerCase().trim());
