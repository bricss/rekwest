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

export const brandCheck = (value, ctor) => {
  if (!(value instanceof ctor)) {
    throw new TypeError('Illegal invocation.');
  }
};

export const copyWithMerge = (target, ...rest) => {
  target = structuredClone(target);
  if (!rest.length) {
    return target;
  }

  return merge(target, ...rest);
};

export const dispatch = (req, { body }) => {
  if (isReadable(body)) {
    body.pipe(req);
  } else {
    req.end(body);
  }
};

export const isFileLike = (value) => {
  return [
    Blob,
    File,
  ].some((it) => value instanceof it);
};

export const isPipeStream = (value) => {
  return value instanceof Readable;
};

export const isReadableStream = (value) => {
  return value instanceof ReadableStream;
};

export const merge = (target, ...rest) => {
  rest = rest.filter((it) => Object(it) === it);
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
    options = copyWithMerge(config.defaults, options);
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
    url: new URL(url, options.baseURL),
  });
};

export const normalizeHeaders = (headers) => {
  const collector = {};

  for (const [key, value] of Object.entries(headers ?? {})) {
    const name = key.toLowerCase();

    collector[key] = value;

    if (key === HTTP2_HEADER_ACCEPT_ENCODING && !isZstdSupported) {
      const stripped = value.replace(/\s?zstd,?/gi, '').trim();

      if (stripped) {
        collector[key] = stripped;
      } else {
        Reflect.deleteProperty(collector, name);
      }
    }
  }

  return collector;
};

export const sameOrigin = (a, b) => a.protocol === b.protocol && a.hostname === b.hostname && a.port === b.port;

export const snoop = (client, req, options) => {
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

export const stripHeaders = (headers = {}, names = []) => {
  names = new Set(names);

  return Object.fromEntries(
    Object.entries(headers).filter(
      ([key]) => !names.has(key.toLowerCase()),
    ),
  );
};

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

export const unwind = (encodings) => encodings.split(',').map((it) => it.toLowerCase().trim());
