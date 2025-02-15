import http2 from 'node:http2';
import { isZstdSupported } from './config.mjs';
import { requestCredentials } from './constants.mjs';
import { Cookies } from './cookies.mjs';

const {
  HTTP2_HEADER_ACCEPT_ENCODING,
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
  const { cookies, credentials, h2, headers, method, url } = options;

  if (h2) {
    options.endStream = [
      HTTP2_METHOD_GET,
      HTTP2_METHOD_HEAD,
    ].includes(method);
  }

  if (cookies !== false && credentials !== requestCredentials.omit) {
    let cookie = Cookies.jar.has(url.origin);

    if (cookies === Object(cookies) && [
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

  if (credentials === requestCredentials.omit) {
    options.cookies = false;
    for (const it of Object.keys(options.headers ?? {})
                           .filter((val) => new RegExp(`^(${
                              HTTP2_HEADER_AUTHORIZATION }|${ HTTP2_HEADER_COOKIE
                            })$`, 'i').test(val))) { Reflect.deleteProperty(options.headers, it); }

    url.password = url.username = '';
  }

  options.headers = {
    ...Object.entries(options.headers ?? {})
             .reduce((acc, [key, val]) => {
               acc[key.toLowerCase()] = val;

               if (acc[HTTP2_HEADER_ACCEPT_ENCODING]?.match(/\bzstd\b/i) && !isZstdSupported) {
                 acc[HTTP2_HEADER_ACCEPT_ENCODING] = val.replace(/\s?zstd,?/i, '').trim();
                 if (!acc[HTTP2_HEADER_ACCEPT_ENCODING]) {
                   Reflect.deleteProperty(acc, HTTP2_HEADER_ACCEPT_ENCODING);
                 }
               }

               return acc;
             }, {}),
    ...h2 && {
      [HTTP2_HEADER_AUTHORITY]: url.host,
      [HTTP2_HEADER_METHOD]: method,
      [HTTP2_HEADER_PATH]: `${ url.pathname }${ url.search }`,
      [HTTP2_HEADER_SCHEME]: url.protocol.replace(/\p{Punctuation}/gu, ''),
    },
  };

  return options;
};
