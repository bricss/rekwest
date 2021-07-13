import { Blob } from 'buffer';
import { globalAgent } from 'http';
import { promisify } from 'util';
import zlib from 'zlib';
import { Cookies } from './cookies.mjs';

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

export const ackn = (res, { digest = false, parse = false } = {}) => {
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
          throw new TypeError('Response stream already read.');
        }

        let spool = [];

        for await (const chunk of this) {
          spool.push(chunk);
        }

        spool = Buffer.concat(spool);

        if (spool.length) {
          spool = await decompress(spool, this.headers['content-encoding'], { async: true });
        }

        if (spool.length && parse) {
          const contentType = this.headers['content-type'] || '';
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
  opts.url = new URL(opts.url);
  opts.agent ??= opts.url.protocol === 'http:' ? globalAgent : void 0;
  if (opts.cookies !== false) {
    let cookie = Cookies.jar.get(opts.url.origin);

    if (opts.cookies === Object(opts.cookies) && !opts.redirected) {
      if (cookie) {
        new Cookies(opts.cookies).forEach(function (val, key) {
          this.set(key, val);
        }, cookie);
      } else {
        cookie = new Cookies(opts.cookies);
        Cookies.jar.set(opts.url.origin, cookie);
      }
    }

    opts.headers = {
      ...cookie ? { cookie } : null,
      ...opts.headers,
    };
  }

  opts.follow ??= 20;
  opts.headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-encoding': 'br, deflate, gzip, identity',
    ...Object.entries(opts.headers || {})
             .reduce((acc, [key, val]) => (acc[key.toLowerCase()] = val, acc), {}),
  };
  opts.parse ??= true;
  opts.redirect ??= 'follow';

  return opts;
};
