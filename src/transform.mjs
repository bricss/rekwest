import http2 from 'node:http2';
import {
  isReadable,
  Readable,
} from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { types } from 'node:util';
import { FormData } from './formdata.mjs';
import {
  APPLICATION_FORM_URLENCODED,
  APPLICATION_JSON,
  APPLICATION_OCTET_STREAM,
} from './mediatypes.mjs';
import {
  compress,
  isFileLike,
  isReadableStream,
} from './utils.mjs';

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

  if (isFileLike(body)) {
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

  if (body === Object(body)
    && (Reflect.has(body, Symbol.asyncIterator) || (!Array.isArray(body) && Reflect.has(body, Symbol.iterator)))) {
    body = isReadable(body) ? (isReadableStream(body) ? Readable.fromWeb(body) : body) : Readable.from(body);
    body = encodings ? compress(body, encodings) : body;
  } else if (encodings) {
    body = await buffer(compress(Readable.from(body), encodings));
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
