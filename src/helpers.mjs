import { Blob } from 'buffer';
import { promisify } from 'util';
import zlib from 'zlib';

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

export const ackn = (res, { digest = false, parse = false } = {}) => {
  if (digest) {
    Object.defineProperties(res, {
      arrayBuffer: {
        enumerable: true,
        value: async function () {
          const stash = parse;

          parse = false;
          const val = await this.body().finally(() => parse = stash);

          return val.buffer;
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
              spool = new TextDecoder(charset).decode(spool.buffer);
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
  if (/\bbr\b/i.test(encoding)) {
    return async ? brotliCompress(buf) : zlib.brotliCompressSync(buf);
  }

  if (/\bdeflate\b/i.test(encoding)) {
    return async ? deflate(buf) : zlib.deflateSync(buf);
  }

  if (/\bgzip\b/i.test(encoding)) {
    return async ? gzip(buf) : zlib.gzipSync(buf);
  }

  return async ? Promise.resolve(buf) : buf;
};

export const decompress = (buf, encoding, { async = false } = {}) => {
  if (/\bbr\b/i.test(encoding)) {
    return async ? brotliDecompress(buf) : zlib.brotliDecompressSync(buf);
  }

  if (/\bdeflate\b/i.test(encoding)) {
    return async ? inflate(buf) : zlib.inflateSync(buf);
  }

  if (/\bgzip\b/i.test(encoding)) {
    return async ? gunzip(buf) : zlib.gunzipSync(buf);
  }

  return async ? Promise.resolve(buf) : buf;
};
