import { Blob } from 'node:buffer';
import http2 from 'node:http2';
import {
  pipeline,
  Readable,
} from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { types } from 'node:util';
import zlib from 'node:zlib';
import { Cookies } from './cookies.mjs';
import { TimeoutError } from './errors.mjs';
import { File } from './file.mjs';
import { FormData } from './formdata.mjs';
import {
  APPLICATION_FORM_URLENCODED,
  APPLICATION_JSON,
  APPLICATION_OCTET_STREAM,
  TEXT_PLAIN,
  WILDCARD,
} from './mediatypes.mjs';

const {
  HTTP2_HEADER_ACCEPT,
  HTTP2_HEADER_ACCEPT_ENCODING,
  HTTP2_HEADER_AUTHORITY,
  HTTP2_HEADER_CONTENT_ENCODING,
  HTTP2_HEADER_CONTENT_LENGTH,
  HTTP2_HEADER_CONTENT_TYPE,
  HTTP2_HEADER_COOKIE,
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_SCHEME,
  HTTP2_HEADER_STATUS,
  HTTP2_METHOD_GET,
  HTTP2_METHOD_HEAD,
} = http2.constants;

const unwind = (encodings) => encodings.split(',').map((it) => it.trim());

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

export const collate = (entity, primordial) => {
  if (entity?.constructor !== primordial) {
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

export const mixin = (res, { digest = false, parse = false } = {}) => {
  if (!digest) {
    Object.defineProperties(res, {
      arrayBuffer: {
        enumerable: true,
        value: async function () {
          collate(this, res?.constructor);
          parse &&= false;
          const { buffer, byteLength, byteOffset } = await this.body();

          return buffer.slice(byteOffset, byteOffset + byteLength);
        },
      },
      blob: {
        enumerable: true,
        value: async function () {
          collate(this, res?.constructor);
          const val = await this.arrayBuffer();

          return new Blob([val]);
        },
      },
      json: {
        enumerable: true,
        value: async function () {
          collate(this, res?.constructor);
          const val = await this.text();

          return JSON.parse(val);
        },
      },
      text: {
        enumerable: true,
        value: async function () {
          collate(this, res?.constructor);
          const blob = await this.blob();

          return blob.text();
        },
      },
    });
  }

  return Object.defineProperties(res, {
    body: {
      enumerable: true,
      value: async function () {
        collate(this, res?.constructor);

        if (this.bodyUsed) {
          throw new TypeError('Response stream already read');
        }

        let body = [];

        for await (const chunk of decompress(this, this.headers[HTTP2_HEADER_CONTENT_ENCODING])) {
          body.push(chunk);
        }

        body = Buffer.concat(body);

        if (!body.length && parse) {
          return null;
        }

        if (body.length && parse) {
          const contentType = this.headers[HTTP2_HEADER_CONTENT_TYPE] ?? '';
          const charset = contentType.split(';')
                                     .find((it) => /charset=/i.test(it))
                                     ?.toLowerCase()
                                     .replace('charset=', '')
                                     .replace('iso-8859-1', 'latin1')
                                     .trim() || 'utf-8';

          if (/\bjson\b/i.test(contentType)) {
            body = JSON.parse(body.toString(charset));
          } else if (/\b(?:text|xml)\b/i.test(contentType)) {
            if (/\b(?:latin1|ucs-2|utf-(?:8|16le))\b/.test(charset)) {
              body = body.toString(charset);
            } else {
              body = new TextDecoder(charset).decode(body);
            }
          }
        }

        return body;
      },
      writable: true,
    },
    bodyUsed: {
      enumerable: true,
      get() {
        return this.readableEnded;
      },
    },
  });
};

export const preflight = (options) => {
  const { cookies, h2 = false, headers, method = HTTP2_METHOD_GET, redirected, url } = options;

  if (h2) {
    options.endStream = [
      HTTP2_METHOD_GET,
      HTTP2_METHOD_HEAD,
    ].includes(method);
  }

  if (cookies !== false) {
    let cookie = Cookies.jar.get(url.origin);

    if (cookies === Object(cookies) && !redirected) {
      if (cookie) {
        new Cookies(cookies).forEach(function (val, key) {
          this.set(key, val);
        }, cookie);
      } else {
        cookie = new Cookies(cookies);
        Cookies.jar.set(url.origin, cookie);
      }
    }

    options.headers = {
      ...cookie && { [HTTP2_HEADER_COOKIE]: cookie },
      ...headers,
    };
  }

  options.digest ??= true;
  options.follow ??= 20;
  options.h2 ??= h2;
  options.headers = {
    [HTTP2_HEADER_ACCEPT]: `${ APPLICATION_JSON }, ${ TEXT_PLAIN }, ${ WILDCARD }`,
    [HTTP2_HEADER_ACCEPT_ENCODING]: 'br, deflate, deflate-raw, gzip, identity',
    ...Object.entries(options.headers ?? {})
             .reduce((acc, [key, val]) => (acc[key.toLowerCase()] = val, acc), {}),
    ...h2 && {
      [HTTP2_HEADER_AUTHORITY]: url.host,
      [HTTP2_HEADER_METHOD]: method,
      [HTTP2_HEADER_PATH]: `${ url.pathname }${ url.search }`,
      [HTTP2_HEADER_SCHEME]: url.protocol.replace(/\p{Punctuation}/gu, ''),
    },
  };

  options.method ??= method;
  options.parse ??= true;
  options.redirect ??= redirects.follow;

  if (!Object.values(redirects).includes(options.redirect)) {
    options.createConnection?.().destroy();
    throw new TypeError(`Failed to read the 'redirect' property from 'options': The provided value '${
      options.redirect
    }' is not a valid enum value.`);
  }

  options.redirected ??= false;
  options.thenable ??= false;

  return options;
};

export const redirects = {
  error: 'error',
  follow: 'follow',
  manual: 'manual',
};

export const sanitize = (url, options = {}) => {
  if (options.trimTrailingSlashes) {
    url = `${ url }`.replace(/(?<!:)\/+/gi, '/');
  }

  url = new URL(url);

  return Object.assign(options, { url });
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

  if (encodings) {
    if (Reflect.has(body, Symbol.asyncIterator)) {
      body = compress(Readable.from(body), encodings);
    } else {
      body = await buffer(compress(Readable.from(body), encodings));
    }
  } else if (body === Object(body)
    && (Reflect.has(body, Symbol.asyncIterator) || (!Array.isArray(body) && Reflect.has(body, Symbol.iterator)))) {
    body = Readable.from(body);
  }

  Object.assign(options.headers, {
    ...headers,
    ...options.headers[HTTP2_HEADER_CONTENT_TYPE] && {
      [HTTP2_HEADER_CONTENT_TYPE]: options.headers[HTTP2_HEADER_CONTENT_TYPE],
    },
  });

  return {
    ...options,
    body,
  };
};
