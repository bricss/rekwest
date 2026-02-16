import http2 from 'node:http2';
import zlib from 'node:zlib';
import {
  requestCredentials,
  requestRedirect,
} from './constants.js';
import {
  APPLICATION_JSON,
  TEXT_PLAIN,
  WILDCARD,
} from './mediatypes.js';

export const isZstdSupported = !!zlib.constants.ZSTD_CLEVEL_DEFAULT;

const {
  HTTP2_HEADER_ACCEPT,
  HTTP2_HEADER_ACCEPT_ENCODING,
  HTTP2_METHOD_GET,
  HTTP_STATUS_BAD_GATEWAY,
  HTTP_STATUS_GATEWAY_TIMEOUT,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_SERVICE_UNAVAILABLE,
  HTTP_STATUS_TOO_MANY_REQUESTS,
} = http2.constants;

const timeout = 3e5;

const defaults = {
  allowDowngrade: false,
  bufferBody: false,
  cookiesTTL: false,
  credentials: requestCredentials.sameOrigin,
  decodersOptions: {},
  digest: true,
  encodersOptions: {
    brotli: {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
      },
    },
    zstd: {
      params: {
        [zlib.constants.ZSTD_c_compressionLevel]: 6,
      },
    },
  },
  follow: 20,
  h2: false,
  headers: {
    [HTTP2_HEADER_ACCEPT]: `${ APPLICATION_JSON }, ${ TEXT_PLAIN }, ${ WILDCARD }`,
    [HTTP2_HEADER_ACCEPT_ENCODING]: `br,${ isZstdSupported ? ' zstd, ' : ' ' }gzip, deflate, deflate-raw`,
  },
  method: HTTP2_METHOD_GET,
  parse: true,
  redirect: requestRedirect.follow,
  retry: {
    attempts: 0,
    backoffStrategy: 'interval * Math.log(Math.random() * (Math.E * Math.E - Math.E) + Math.E)',
    errorCodes: [
      'ECONNREFUSED',
      'ECONNRESET',
      'EHOSTDOWN',
      'EHOSTUNREACH',
      'ENETDOWN',
      'ENETUNREACH',
      'ENOTFOUND',
      'ERR_HTTP2_STREAM_ERROR',
    ],
    interval: 1e3,
    maxRetryAfter: timeout,
    retryAfter: true,
    statusCodes: [
      HTTP_STATUS_TOO_MANY_REQUESTS,
      HTTP_STATUS_INTERNAL_SERVER_ERROR,
      HTTP_STATUS_BAD_GATEWAY,
      HTTP_STATUS_SERVICE_UNAVAILABLE,
      HTTP_STATUS_GATEWAY_TIMEOUT,
    ],
  },
  stripTrailingSlash: false,
  thenable: false,
  timeout,
  trimTrailingSlashes: false,
};

export default {
  defaults,
};
