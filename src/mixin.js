import { Blob } from 'node:buffer';
import http2 from 'node:http2';
import { buffer } from 'node:stream/consumers';
import { MIMEType } from 'node:util';
import { decode } from './codecs.js';
import { brandCheck } from './utils.js';

const {
  HTTP2_HEADER_CONTENT_ENCODING,
  HTTP2_HEADER_CONTENT_TYPE,
} = http2.constants;

export const mixin = (res, { decodersOptions, digest = false, parse = false } = {}) => {
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
          throw new TypeError('Response stream already read.');
        }

        let body = await buffer(decode(this, this.headers[HTTP2_HEADER_CONTENT_ENCODING], { decodersOptions }));

        if (!body.length && parse) {
          return null;
        }

        if (body.length && parse) {
          const contentType = this.headers[HTTP2_HEADER_CONTENT_TYPE] ?? '';
          let isTextual, mimeType;

          try {
            mimeType = contentType ? new MIMEType(contentType) : null;
          } finally {
            isTextual = mimeType && (
              mimeType.type === 'text'
              || mimeType.subtype.match(/\bcsv\b|\bjson\b|\bxml\b|\byaml\b/)
              || mimeType.essence.match(/\becmascript\b|\bjavascript\b|\bx-www-form-urlencoded\b/)
            );
          }

          if (isTextual) {
            if (/\bjson\b/i.test(contentType)) {
              body = JSON.parse(body.toString());
            } else {
              const charset = mimeType.params.get('charset')?.toLowerCase() ?? 'utf-8';

              body = new TextDecoder(charset, { fatal: true }).decode(body);
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
