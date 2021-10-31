import { Blob } from 'buffer';
import { globalAgent } from 'http';
import http2 from 'http2';
import {
  PassThrough,
  Readable,
} from 'stream';
import {
  promisify,
  types,
} from 'util';
import zlib from 'zlib';
import { Cookies } from './cookies.mjs';
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
  HTTP2_METHOD_GET,
  HTTP2_METHOD_HEAD,
} = http2.constants;

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

export const compress = (buf, encoding, { async = false } = {}) => {
  encoding &&= encoding.match(/\bbr\b|\bdeflate\b|\bgzip\b/i)?.[0].toLowerCase();
  const compressor = {
    br: async ? brotliCompress : zlib.brotliCompressSync,
    deflate: async ? deflate : zlib.deflateSync,
    gzip: async ? gzip : zlib.gzipSync,
  }[encoding];

  return compressor?.(buf) ?? (async ? Promise.resolve(buf) : buf);
};

export const decompress = (buf, encoding, { async = false } = {}) => {
  encoding &&= encoding.match(/\bbr\b|\bdeflate\b|\bgzip\b/i)?.[0].toLowerCase();
  const decompressor = {
    br: async ? brotliDecompress : zlib.brotliDecompressSync,
    deflate: async ? inflate : zlib.inflateSync,
    gzip: async ? gunzip : zlib.gunzipSync,
  }[encoding];

  return decompressor?.(buf) ?? (async ? Promise.resolve(buf) : buf);
};

export const dispatch = (req, { body, headers }) => {
  if (types.isUint8Array(body)) {
    return req.end(body);
  }

  if (body === Object(body)) {
    if (!Buffer.isBuffer(body) && body.pipe?.constructor !== Function) {
      if (Reflect.has(body, Symbol.asyncIterator) || Reflect.has(body, Symbol.iterator)) {
        body = Readable.from(body);
      }
    }

    if (body.pipe?.constructor === Function) {
      const compressor = {
        br: zlib.createBrotliCompress,
        deflate: zlib.createDeflate,
        gzip: zlib.createGzip,
      }[headers[HTTP2_HEADER_CONTENT_ENCODING]] ?? PassThrough;

      body.pipe(compressor()).pipe(req);
    }
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

export const preflight = (options) => {
  const url = options.url = new URL(options.url);
  const { cookies, h2 = false, method = HTTP2_METHOD_GET, headers, redirected } = options;

  if (!h2) {
    options.agent ??= url.protocol === 'http:' ? globalAgent : void 0;
  } else {
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
    [HTTP2_HEADER_ACCEPT_ENCODING]: 'br, deflate, gzip, identity',
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
  options.redirect ??= 'follow';
  options.redirected ??= false;
  options.thenable ??= false;

  return options;
};

export const premix = (res, { digest = false, parse = false } = {}) => {
  if (!digest) {
    Object.defineProperties(res, {
      arrayBuffer: {
        enumerable: true,
        value: async function () {
          const stash = parse;

          parse = false;
          const { buffer, byteLength, byteOffset } = await this.body().finally(() => parse = stash);

          return buffer.slice(byteOffset, byteOffset + byteLength);
        },
      },
      blob: {
        enumerable: true,
        value: async function () {
          const val = await this.arrayBuffer();

          return new Blob([val]);
        },
      },
      json: {
        enumerable: true,
        value: async function () {
          const val = await this.text();

          return JSON.parse(val);
        },
      },
      text: {
        enumerable: true,
        value: async function () {
          const val = await this.blob().then((blob) => blob.text());

          return val.toString();
        },
      },
    });
  }

  return Object.defineProperties(res, {
    body: {
      enumerable: true,
      value: async function () {
        if (this.bodyUsed) {
          throw new TypeError('Response stream already read');
        }

        let spool = [];

        for await (const chunk of this) {
          spool.push(chunk);
        }

        spool = Buffer.concat(spool);

        if (spool.length) {
          spool = await decompress(spool, this.headers[HTTP2_HEADER_CONTENT_ENCODING], { async: true });
        }

        if (spool.length && parse) {
          const contentType = this.headers[HTTP2_HEADER_CONTENT_TYPE] ?? '';
          const charset = contentType.split(';')
                                     .find((it) => /charset=/i.test(it))
                                     ?.toLowerCase()
                                     ?.replace('charset=', '')
                                     ?.replace('iso-8859-1', 'latin1')
                                     ?.trim() || 'utf-8';

          if (/json/i.test(contentType)) {
            spool = JSON.parse(spool.toString(charset));
          } else if (/text|xml/i.test(contentType)) {
            if (/latin1|utf-(8|16le)|ucs-2/.test(charset)) {
              spool = spool.toString(charset);
            } else {
              spool = new TextDecoder(charset).decode(spool);
            }
          }
        }

        return spool;
      },
      writable: true,
    },
    bodyUsed: {
      enumerable: true,
      get: function () {
        return this.readableEnded;
      },
    },
  });
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

export const transform = (body, options) => {
  let headers = {};

  if (File.alike(body)) {
    headers = {
      [HTTP2_HEADER_CONTENT_LENGTH]: body.size,
      [HTTP2_HEADER_CONTENT_TYPE]: body.type || APPLICATION_OCTET_STREAM,
    };
    body = body.stream?.() ?? Readable.from(tap(body));
  } else if (FormData.alike(body)) {
    body = FormData.actuate(body);
    headers = { [HTTP2_HEADER_CONTENT_TYPE]: body.contentType };
  } else if (body === Object(body) && !Reflect.has(body, Symbol.asyncIterator)) {
    if (body.constructor === URLSearchParams) {
      headers = { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_FORM_URLENCODED };
      body = body.toString();
    } else if (!Buffer.isBuffer(body)
      && !(!Array.isArray(body) && Reflect.has(body, Symbol.iterator))) {
      headers = { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_JSON };
      body = JSON.stringify(body);
    }

    if (types.isUint8Array(body) || Buffer.isBuffer(body) || body !== Object(body)) {
      if (options.headers[HTTP2_HEADER_CONTENT_ENCODING]) {
        body = compress(body, options.headers[HTTP2_HEADER_CONTENT_ENCODING]);
      }

      headers = {
        ...headers,
        [HTTP2_HEADER_CONTENT_LENGTH]: Buffer.byteLength(body),
      };
    }
  }

  Object.assign(options.headers, {
    ...headers,
    ...options.headers[HTTP2_HEADER_CONTENT_TYPE] && {
      [HTTP2_HEADER_CONTENT_TYPE]: options.headers[HTTP2_HEADER_CONTENT_TYPE],
    },
  });

  return body;
};
