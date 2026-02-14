import http2 from 'node:http2';
import { isReadable } from 'node:stream';
import { setTimeout as setTimeoutPromise } from 'node:timers/promises';
import { RequestError } from './errors.js';
import rekwest from './index.js';
import { isPipeStream } from './utils.js';

const {
  HTTP2_HEADER_RETRY_AFTER,
  HTTP2_METHOD_GET,
  HTTP2_METHOD_HEAD,
} = http2.constants;

export const retries = (err, options) => {
  const { body, maxRetryAfter, method, retry, url } = options;

  if (retry?.attempts > 0) {
    if (![
      HTTP2_METHOD_GET,
      HTTP2_METHOD_HEAD,
    ].includes(method) && isPipeStream(body) && !isReadable(body)) {
      throw new RequestError('Request stream already read.', { cause: err });
    }

    if (retry.errorCodes?.includes(err.code) || retry.statusCodes?.includes(err.statusCode)) {
      let { interval } = retry;

      if (retry.retryAfter && err.headers?.[HTTP2_HEADER_RETRY_AFTER]) {
        interval = err.headers[HTTP2_HEADER_RETRY_AFTER];
        interval = Math.abs(Number(interval) * 1e3 || new Date(interval) - Date.now()) || 0;
        if (interval > maxRetryAfter) {
          throw new RequestError(
            `Maximum '${ HTTP2_HEADER_RETRY_AFTER }' limit exceeded: ${ interval } ms.`,
            { cause: err },
          );
        }
      } else {
        interval = new Function('interval', `return Math.ceil(${ retry.backoffStrategy });`)(interval);
      }

      if (interval < 0) {
        interval = 0;
      }

      retry.attempts--;
      retry.interval = interval;

      return setTimeoutPromise(interval).then(() => rekwest(url, options));
    }
  }
};
