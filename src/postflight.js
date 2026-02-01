import http2 from 'node:http2';
import { Cookies } from './cookies.js';
import { mixin } from './mixin.js';
import { redirects } from './redirects.js';
import { augment } from './utils.js';

const {
  HTTP2_HEADER_SET_COOKIE,
  HTTP_STATUS_BAD_REQUEST,
} = http2.constants;

export const postflight = (req, res, options, { reject, resolve }) => {
  const { cookies, h2, url } = options;
  let headers;

  if (h2) {
    headers = res;
    res = req;
  } else {
    res.once('error', reject);
  }

  augment(res, headers, options);

  if (cookies !== false && res.headers[HTTP2_HEADER_SET_COOKIE]) {
    if (Cookies.jar.has(url.origin)) {
      const cookie = new Cookies(res.headers[HTTP2_HEADER_SET_COOKIE], options);

      Cookies.jar.get(url.origin).forEach((val, key) => {
        if (!cookie.has(key)) {
          cookie.set(key, val);
        }
      });
      Cookies.jar.set(url.origin, cookie);
    } else {
      Cookies.jar.set(url.origin, new Cookies(res.headers[HTTP2_HEADER_SET_COOKIE], options));
    }
  }

  Reflect.defineProperty(res, 'cookies', {
    enumerable: true,
    value: cookies !== false && Cookies.jar.has(url.origin) ? Cookies.jar.get(url.origin) : void 0,
  });

  const willRedirect = redirects(res, options);

  if (Object(willRedirect) === willRedirect) {
    return willRedirect.then(resolve, reject);
  }

  if (res.statusCode >= HTTP_STATUS_BAD_REQUEST) {
    return reject(mixin(res, options));
  }

  resolve(mixin(res, options));
};
