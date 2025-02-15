import http2 from 'node:http2';
import zlib from 'node:zlib';
import {
  requestCredentials,
  requestRedirect,
} from './constants.mjs';
import {
  APPLICATION_JSON,
  TEXT_PLAIN,
  WILDCARD,
} from './mediatypes.mjs';
import { maxRetryAfter } from './utils.mjs';

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

export const isZstdSupported = !!zlib.constants.ZSTD_CLEVEL_DEFAULT;

const defaults = {
  cookiesTTL: false,
  credentials: requestCredentials.sameOrigin,
  digest: true,
  follow: 20,
  h2: false,
  headers: {
    [HTTP2_HEADER_ACCEPT]: `${ APPLICATION_JSON }, ${ TEXT_PLAIN }, ${ WILDCARD }`,
    [HTTP2_HEADER_ACCEPT_ENCODING]: `br,${ isZstdSupported ? ' zstd, ' : ' ' }gzip, deflate, deflate-raw`,
  },
  get maxRetryAfter() {
    return this[maxRetryAfter] ?? this.timeout;
  },
  set maxRetryAfter(value) {
    this[maxRetryAfter] = value;
  },
  method: HTTP2_METHOD_GET,
  parse: true,
  redirect: requestRedirect.follow,
  redirected: false,
  retry: {
    attempts: 0,
    backoffStrategy: 'interval * Math.log(Math.random() * (Math.E * Math.E - Math.E) + Math.E)',
    errorCodes: [
      'EAI_AGAIN',
      'ECONNREFUSED',
      'ECONNRESET',
      'EHOSTDOWN',
      'EHOSTUNREACH',
      'ENETDOWN',
      'ENETUNREACH',
      'ENOTFOUND',
      'EPIPE',
      'ERR_HTTP2_STREAM_ERROR',
    ],
    interval: 1e3,
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
  timeout: 3e5,
  trimTrailingSlashes: false,
};

export default {
  defaults,
};
