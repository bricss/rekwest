import { Blob } from 'node:buffer';
import http2 from 'node:http2';
import {
  brandCheck,
  decompress,
} from './utils.mjs';

const {
  HTTP2_HEADER_CONTENT_ENCODING,
  HTTP2_HEADER_CONTENT_TYPE,
} = http2.constants;

export const mixin = (res, { decompression, digest = false, parse = false } = {}) => {
  if (!digest) {
    Object.defineProperties(res, {
      arrayBuffer: {
        enumerable: true,
        value: async function () {
          brandCheck(this, res?.constructor);
          parse &&= false;
          const { buffer, byteLength, byteOffset } = await this.body();

          return buffer.slice(byteOffset, byteOffset + byteLength);
        },
      },
      blob: {
        enumerable: true,
        value: async function () {
          brandCheck(this, res?.constructor);
          const val = await this.arrayBuffer();

          return new Blob([val]);
        },
      },
      bytes: {
        enumerable: true,
        value: async function () {
          brandCheck(this, res?.constructor);

          return new Uint8Array(await this.arrayBuffer());
        },
      },
      json: {
        enumerable: true,
        value: async function () {
          brandCheck(this, res?.constructor);
          const val = await this.text();

          return JSON.parse(val);
        },
      },
      text: {
        enumerable: true,
        value: async function () {
          brandCheck(this, res?.constructor);
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
        brandCheck(this, res?.constructor);

        if (this.bodyUsed) {
          throw new TypeError('Response stream already read');
        }

        let body = [];

        for await (const chunk of decompress(this, this.headers[HTTP2_HEADER_CONTENT_ENCODING], { decompression })) {
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
            if (/\b(?:latin1|ucs-2|utf-(?:8|16le))\b/i.test(charset)) {
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
