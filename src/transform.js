import http2 from 'node:http2';
import {
  isReadable,
  Readable,
} from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { types } from 'node:util';
import { encode } from './codecs.js';
import { FormData } from './formdata.js';
import {
  APPLICATION_FORM_URLENCODED,
  APPLICATION_JSON,
  APPLICATION_OCTET_STREAM,
} from './mediatypes.js';
import {
  isFileLike,
  isReadableStream,
} from './utils.js';

const {
  HTTP2_HEADER_CONTENT_ENCODING,
  HTTP2_HEADER_CONTENT_LENGTH,
  HTTP2_HEADER_CONTENT_TYPE,
} = http2.constants;

export const transform = async (options) => {
  let { body, headers } = options;

  if (!body) {
    return options;
  }

  if (!Buffer.isBuffer(body)) {
    switch (true) {
      case isFileLike(body): {
        headers = {
          [HTTP2_HEADER_CONTENT_LENGTH]: body.size,
          [HTTP2_HEADER_CONTENT_TYPE]: body.type || APPLICATION_OCTET_STREAM,
        };
        body = body.stream();
        break;
      }

      case FormData.alike(body): {
        body = FormData.actuate(body);
        headers = { [HTTP2_HEADER_CONTENT_TYPE]: body.contentType };
        break;
      }

      case types.isAnyArrayBuffer(body): {
        body = Buffer.from(body);
        break;
      }

      case types.isArrayBufferView(body): {
        body = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
        break;
      }

      case Object(body) === body && !Reflect.has(body, Symbol.asyncIterator): {
        if (body.constructor === URLSearchParams) {
          headers = { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_FORM_URLENCODED };
          body = body.toString();
        } else if (!(!Array.isArray(body) && Reflect.has(body, Symbol.iterator))) {
          headers = { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_JSON };
          body = JSON.stringify(body);
        }

        break;
      }

      default:
        break;
    }
  }

  const encodings = options.headers[HTTP2_HEADER_CONTENT_ENCODING];

  if (Object(body) === body
    && (Reflect.has(body, Symbol.asyncIterator) || (!Array.isArray(body) && Reflect.has(body, Symbol.iterator)))) {
    body = isReadable(body) ? (isReadableStream(body) ? Readable.fromWeb(body) : body) : Readable.from(body);
    body = encodings ? encode(body, encodings, options) : body;
  } else if (encodings) {
    body = await buffer(encode(Readable.from(body), encodings, options));
  }

  if (options.bufferBody && Object(body) === body) {
    if (isReadable(body)) {
      body = await buffer(body);
    } else if (Reflect.has(body, Symbol.asyncIterator)) {
      body = await buffer(body);
    }
  }

  Object.assign(options.headers, {
    ...headers,
    ...!body[Symbol.asyncIterator] && {
      [HTTP2_HEADER_CONTENT_LENGTH]: Buffer.byteLength(body),
    },
    ...options.headers[HTTP2_HEADER_CONTENT_TYPE] && {
      [HTTP2_HEADER_CONTENT_TYPE]: options.headers[HTTP2_HEADER_CONTENT_TYPE],
    },
  });

  return {
    ...options,
    body,
  };
};
