import { pipeline } from 'node:stream';
import zlib from 'node:zlib';
import { isZstdSupported } from './config.js';
import { unwind } from './utils.js';

export const decodeCodecs = {
  br: (opts) => zlib.createBrotliDecompress(opts?.brotli),
  deflate: (opts) => zlib.createInflate(opts?.zlib),
  'deflate-raw': (opts) => zlib.createInflateRaw(opts?.zlib),
  gzip: (opts) => zlib.createGunzip(opts?.zlib),
  zstd: (opts) => isZstdSupported && zlib.createZstdDecompress(opts?.zstd),
};

export const decode = (readable, encodings = '', { decodersOptions } = {}) => {
  const decoders = [];

  encodings = unwind(encodings).reverse();

  for (const encoding of encodings) {
    const decoder = decodeCodecs[encoding]?.(decodersOptions);

    if (!decoder) {
      return readable;
    }

    decoders.push(decoder);
  }

  return pipeline(readable, ...decoders, () => void 0);
};

export const encodeCodecs = {
  br: (opts) => zlib.createBrotliCompress(opts?.brotli),
  deflate: (opts) => zlib.createDeflate(opts?.zlib),
  'deflate-raw': (opts) => zlib.createDeflateRaw(opts?.zlib),
  gzip: (opts) => zlib.createGzip(opts?.zlib),
  zstd: (opts) => isZstdSupported && zlib.createZstdCompress(opts?.zstd),
};

export const encode = (readable, encodings = '', { encodersOptions } = {}) => {
  const encoders = [];

  encodings = unwind(encodings);

  for (const encoding of encodings) {
    const encoder = encodeCodecs[encoding]?.(encodersOptions);

    if (!encoder) {
      return readable;
    }

    encoders.push(encoder);
  }

  return pipeline(readable, ...encoders, () => void 0);
};
