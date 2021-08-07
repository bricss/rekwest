import { Blob } from 'buffer';
import { globalAgent } from 'http';
import http2 from 'http2';
import { promisify } from 'util';
import zlib from 'zlib';
import { Cookies } from './cookies.mjs';

const {
        HTTP2_HEADER_ACCEPT,
        HTTP2_HEADER_ACCEPT_ENCODING,
        HTTP2_HEADER_AUTHORITY,
        HTTP2_HEADER_CONTENT_ENCODING,
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

  return compressor?.(buf) || (async ? Promise.resolve(buf) : buf);
};

export const decompress = (buf, encoding, { async = false } = {}) => {
  encoding &&= encoding.match(/\bbr\b|\bdeflate\b|\bgzip\b/i)?.[0].toLowerCase();
  const decompressor = {
    br: async ? brotliDecompress : zlib.brotliDecompressSync,
    deflate: async ? inflate : zlib.inflateSync,
    gzip: async ? gunzip : zlib.gunzipSync,
  }[encoding];

  return decompressor?.(buf) || (async ? Promise.resolve(buf) : buf);
};

export const merge = (target = {}, ...rest) => {
  target = JSON.parse(JSON.stringify(target));
  if (!rest.length) {
    return target;
  }

  rest.filter((it) => it === Object(it)).forEach((it) => {
    Object.entries(it).reduce((acc, [key, val]) => {
      if ([
        Array,
        Object,
      ].includes(val?.constructor)) {
        acc[key] = merge(acc[key], val);
      } else {
        acc[key] = val;
      }

      return acc;
    }, target);
  });

  return target;
};

export const preflight = (opts) => {
  const url = opts.url = new URL(opts.url);
  const { cookies, h2 = false, method = HTTP2_METHOD_GET, headers, redirected } = opts;

  if (!h2) {
    opts.agent ??= url.protocol === 'http:' ? globalAgent : void 0;
  } else {
    opts.endStream = [
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

    opts.headers = {
      ...cookie && { [HTTP2_HEADER_COOKIE]: cookie },
      ...headers,
    };
  }

  opts.digest ??= true;
  opts.follow ??= 20;
  opts.h2 ??= h2;
  opts.headers = {
    [HTTP2_HEADER_ACCEPT]: 'application/json, text/plain, */*',
    [HTTP2_HEADER_ACCEPT_ENCODING]: 'br, deflate, gzip, identity',
    ...Object.entries(opts.headers || {})
             .reduce((acc, [key, val]) => (acc[key.toLowerCase()] = val, acc), {}),
    ...h2 && {
      [HTTP2_HEADER_AUTHORITY]: url.host,
      [HTTP2_HEADER_METHOD]: method,
      [HTTP2_HEADER_PATH]: `${ url.pathname }${ url.search }`,
      [HTTP2_HEADER_SCHEME]: url.protocol.replaceAll(':', ''),
    },
  };

  opts.method ??= method;
  opts.parse ??= true;
  opts.redirect ??= 'follow';
  opts.redirected ??= false;
  opts.thenable ??= false;

  return opts;
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
          const contentType = this.headers[HTTP2_HEADER_CONTENT_TYPE] || '';
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
              spool = new TextDecoder(charset).decode(Uint8Array.from(spool).buffer);
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
