import http2 from 'node:http2';
import {
  requestCredentials,
  requestRedirect,
} from './constants.mjs';
import { maxRetryAfter } from './utils.mjs';

const {
  HTTP2_METHOD_GET,
  HTTP_STATUS_SERVICE_UNAVAILABLE,
  HTTP_STATUS_TOO_MANY_REQUESTS,
} = http2.constants;

const stash = {
  credentials: requestCredentials.sameOrigin,
  digest: true,
  follow: 20,
  h2: false,
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
    interval: 1e3,
    retryAfter: true,
    statusCodes: [
      HTTP_STATUS_TOO_MANY_REQUESTS,
      HTTP_STATUS_SERVICE_UNAVAILABLE,
    ],
  },
  thenable: false,
  timeout: 3e5,
  trimTrailingSlashes: false,
};

export default {
  stash,
};
