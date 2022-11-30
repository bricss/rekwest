import http2 from 'node:http2';
import { requestCredentials } from './constants.mjs';
import { Cookies } from './cookies.mjs';
import {
  APPLICATION_JSON,
  TEXT_PLAIN,
  WILDCARD,
} from './mediatypes.mjs';

const {
  HTTP2_HEADER_ACCEPT,
  HTTP2_HEADER_ACCEPT_ENCODING,
  HTTP2_HEADER_AUTHORITY,
  HTTP2_HEADER_COOKIE,
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_SCHEME,
  HTTP2_METHOD_GET,
  HTTP2_METHOD_HEAD,
} = http2.constants;

export const preflight = (options) => {
  const { cookies, credentials, h2 = false, headers, method, url } = options;

  if (h2) {
    options.endStream = [
      HTTP2_METHOD_GET,
      HTTP2_METHOD_HEAD,
    ].includes(method);
  }

  if (cookies !== false) {
    let cookie = Cookies.jar.get(url.origin);

    if (cookies === Object(cookies) && [
      requestCredentials.include,
      requestCredentials.sameOrigin,
    ].includes(credentials)) {
      if (cookie) {
        new Cookies(cookies).forEach(function (val, key) {
          this.set(key, val);
        }, cookie);
      } else {
        cookie = new Cookies(cookies);
        Cookies.jar.set(url.origin, cookie);
      }
    }

    options.headers = {
      ...cookie && { [HTTP2_HEADER_COOKIE]: cookie },
      ...headers,
    };
  }

  options.h2 ??= h2;
  options.headers = {
    [HTTP2_HEADER_ACCEPT]: `${ APPLICATION_JSON }, ${ TEXT_PLAIN }, ${ WILDCARD }`,
    [HTTP2_HEADER_ACCEPT_ENCODING]: 'br, deflate, deflate-raw, gzip, identity',
    ...Object.entries(options.headers ?? {})
             .reduce((acc, [key, val]) => (acc[key.toLowerCase()] = val, acc), {}),
    ...h2 && {
      [HTTP2_HEADER_AUTHORITY]: url.host,
      [HTTP2_HEADER_METHOD]: method,
      [HTTP2_HEADER_PATH]: `${ url.pathname }${ url.search }`,
      [HTTP2_HEADER_SCHEME]: url.protocol.replace(/\p{Punctuation}/gu, ''),
    },
  };

  return options;
};
