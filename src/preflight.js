import http2 from 'node:http2';
import { requestCredentials } from './constants.js';
import { Cookies } from './cookies.js';
import { stripHeaders } from './utils.js';

const {
  HTTP2_HEADER_AUTHORITY,
  HTTP2_HEADER_AUTHORIZATION,
  HTTP2_HEADER_COOKIE,
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_SCHEME,
  HTTP2_METHOD_GET,
  HTTP2_METHOD_HEAD,
} = http2.constants;

export const preflight = (options) => {
  let { cookies, credentials, h2, headers, method, url } = options;

  if (h2) {
    options.endStream = [
      HTTP2_METHOD_GET,
      HTTP2_METHOD_HEAD,
    ].includes(method);
  } else {
    headers = stripHeaders(headers, [
      HTTP2_HEADER_AUTHORITY,
      HTTP2_HEADER_METHOD,
      HTTP2_HEADER_PATH,
      HTTP2_HEADER_SCHEME,
    ]);
  }

  if (credentials === requestCredentials.omit) {
    cookies = false;
    headers = stripHeaders(headers, [
      HTTP2_HEADER_AUTHORIZATION,
      HTTP2_HEADER_COOKIE,
    ]);
    url.password = url.username = '';
  }

  if (cookies !== false && credentials !== requestCredentials.omit) {
    let cookie = Cookies.jar.has(url.origin);

    if (Object(cookies) === cookies && [
      requestCredentials.include,
      requestCredentials.sameOrigin,
    ].includes(credentials)) {
      if (cookie) {
        cookie = new Cookies(cookies, options);

        Cookies.jar.get(url.origin).forEach((val, key) => {
          if (!cookie.has(key)) {
            cookie.set(key, val);
          }
        });
        Cookies.jar.set(url.origin, cookie);
      } else {
        cookie = new Cookies(cookies, options);
        Cookies.jar.set(url.origin, cookie);
      }
    } else {
      cookie &&= Cookies.jar.get(url.origin);
    }

    options.headers = {
      ...cookie && { [HTTP2_HEADER_COOKIE]: cookie },
      ...headers,
    };
  }

  options.headers = {
    ...headers,
    ...h2 && {
      [HTTP2_HEADER_AUTHORITY]: url.host,
      [HTTP2_HEADER_METHOD]: method,
      [HTTP2_HEADER_PATH]: `${ url.pathname }${ url.search }`,
      [HTTP2_HEADER_SCHEME]: url.protocol.replace(/\p{Punctuation}/gu, ''),
    },
  };

  return options;
};
