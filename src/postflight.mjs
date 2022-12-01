import http2 from 'node:http2';
import { setTimeout as setTimeoutPromise } from 'node:timers/promises';
import {
  requestCredentials,
  requestRedirect,
  requestRedirectCodes,
} from './constants.mjs';
import { Cookies } from './cookies.mjs';
import { RequestError } from './errors.mjs';
import rekwest from './index.mjs';
import {
  admix,
  maxRetryAfterError,
  mixin,
  sameOrigin,
} from './utils.mjs';

const {
  HTTP2_HEADER_AUTHORIZATION,
  HTTP2_HEADER_LOCATION,
  HTTP2_HEADER_RETRY_AFTER,
  HTTP2_HEADER_SET_COOKIE,
  HTTP2_METHOD_GET,
  HTTP2_METHOD_HEAD,
  HTTP2_METHOD_POST,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_FOUND,
  HTTP_STATUS_MOVED_PERMANENTLY,
  HTTP_STATUS_SEE_OTHER,
} = http2.constants;

export const postflight = (req, res, options, { reject, resolve }) => {
  const { cookies, credentials, follow, h2, redirect, url } = options;
  let headers;

  if (h2) {
    headers = res;
    res = req;
  } else {
    res.once('error', reject);
  }

  admix(res, headers, options);

  if (cookies !== false && res.headers[HTTP2_HEADER_SET_COOKIE]) {
    if (Cookies.jar.has(url.origin)) {
      new Cookies(res.headers[HTTP2_HEADER_SET_COOKIE]).forEach(function (val, key) {
        this.set(key, val);
      }, Cookies.jar.get(url.origin));
    } else {
      Cookies.jar.set(url.origin, new Cookies(res.headers[HTTP2_HEADER_SET_COOKIE]));
    }
  }

  Reflect.defineProperty(res, 'cookies', {
    enumerable: true,
    value: cookies !== false && Cookies.jar.has(url.origin)
           ? Cookies.jar.get(url.origin)
           : void 0,
  });

  const { statusCode } = res;

  if (follow && /3\d{2}/.test(statusCode) && res.headers[HTTP2_HEADER_LOCATION]) {
    if (!requestRedirectCodes.includes(statusCode)) {
      return res.emit('error', new RangeError(`Invalid status code: ${ statusCode }`));
    }

    if (redirect === requestRedirect.error) {
      return res.emit('error', new RequestError(`Unexpected redirect, redirect mode is set to '${ redirect }'.`));
    }

    if (redirect === requestRedirect.follow) {
      const location = new URL(res.headers[HTTP2_HEADER_LOCATION], url);

      if (!/^https?:/i.test(location.protocol)) {
        return res.emit('error', new RequestError('URL scheme must be "http" or "https".'));
      }

      if (!sameOrigin(location, url) && [
        requestCredentials.omit,
        requestCredentials.sameOrigin,
      ].includes(credentials)) {
        Reflect.deleteProperty(options.headers, HTTP2_HEADER_AUTHORIZATION);
        location.password = location.username = '';
        if (credentials === requestCredentials.omit) {
          options.cookies = false;
        }
      }

      options.url = location;

      if (statusCode !== HTTP_STATUS_SEE_OTHER && options.body?.pipe?.constructor === Function) {
        return res.emit('error', new RequestError(`Unable to ${ redirect } redirect with streamable body.`));
      }

      options.follow--;

      if (([
        HTTP_STATUS_MOVED_PERMANENTLY,
        HTTP_STATUS_FOUND,
      ].includes(statusCode) && options.method === HTTP2_METHOD_POST) || (statusCode === HTTP_STATUS_SEE_OTHER && ![
        HTTP2_METHOD_GET,
        HTTP2_METHOD_HEAD,
      ].includes(options.method))) {
        Object.keys(options.headers).filter((it) => /^content-/i.test(it))
              .forEach((it) => Reflect.deleteProperty(options.headers, it));
        options.body = null;
        options.method = HTTP2_METHOD_GET;
      }

      Reflect.set(options, 'h2', false);
      Reflect.set(options, 'redirected', true);

      if (statusCode === HTTP_STATUS_MOVED_PERMANENTLY && res.headers[HTTP2_HEADER_RETRY_AFTER]) {
        let interval = res.headers[HTTP2_HEADER_RETRY_AFTER];

        interval = Number(interval) * 1000 || new Date(interval) - Date.now();

        if (interval > options.maxRetryAfter) {
          return res.emit('error', maxRetryAfterError(interval, { cause: mixin(res, options) }));
        }

        return setTimeoutPromise(interval).then(() => rekwest(options.url, options).then(resolve, reject));
      }

      return rekwest(options.url, options).then(resolve, reject);
    }
  }

  if (statusCode >= HTTP_STATUS_BAD_REQUEST) {
    return reject(mixin(res, options));
  }

  resolve(mixin(res, options));
};
