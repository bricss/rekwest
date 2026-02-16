import http2 from 'node:http2';
import { isReadable } from 'node:stream';
import {
  requestCredentials,
  requestRedirect,
} from './constants.js';
import { RequestError } from './errors.js';
import rekwest from './index.js';
import {
  isPipeStream,
  sameOrigin,
} from './utils.js';

const {
  HTTP2_HEADER_LOCATION,
  HTTP2_METHOD_GET,
  HTTP2_METHOD_HEAD,
  HTTP2_METHOD_POST,
  HTTP_STATUS_FOUND,
  HTTP_STATUS_MOVED_PERMANENTLY,
  HTTP_STATUS_PERMANENT_REDIRECT,
  HTTP_STATUS_SEE_OTHER,
  HTTP_STATUS_TEMPORARY_REDIRECT,
} = http2.constants;

export const redirects = (res, options) => {
  const {
    allowDowngrade,
    credentials,
    follow,
    redirect,
    url,
  } = options;

  if (follow && /3\d{2}/.test(res.statusCode) && res.headers[HTTP2_HEADER_LOCATION]) {
    if (redirect === requestRedirect.error) {
      throw new RequestError(`Unexpected redirect, redirect mode is set to: ${ redirect }`);
    }

    if (redirect === requestRedirect.follow) {
      const loc = new URL(res.headers[HTTP2_HEADER_LOCATION], url);

      if (!/^https?:/i.test(loc.protocol)) {
        throw new RequestError('URL scheme must be "http" or "https"');
      }

      if (!allowDowngrade && loc.protocol === 'http:' && url.protocol === 'https:') {
        throw new RequestError(
          `Protocol downgrade detected, redirect from "${ url.protocol }" to "${ loc.protocol }": ${ loc }`,
        );
      }

      if (!sameOrigin(loc, url)) {
        if (credentials !== requestCredentials.include) {
          options.credentials = requestCredentials.omit;
        }

        options.h2 = false;
      }

      if ([
        HTTP_STATUS_PERMANENT_REDIRECT,
        HTTP_STATUS_TEMPORARY_REDIRECT,
      ].includes(res.statusCode) && isPipeStream(options.body) && !isReadable(options.body)) {
        throw new RequestError(`Unable to ${ redirect } redirect with streamable body`);
      }

      if (([
        HTTP_STATUS_MOVED_PERMANENTLY,
        HTTP_STATUS_FOUND,
      ].includes(res.statusCode) && options.method === HTTP2_METHOD_POST)
      || (res.statusCode === HTTP_STATUS_SEE_OTHER && ![
        HTTP2_METHOD_GET,
        HTTP2_METHOD_HEAD,
      ].includes(options.method))) {
        options.body = null;
        options.method = HTTP2_METHOD_GET;
      }

      options.follow--;
      options.redirected = true;

      return rekwest(loc, options);
    }
  }
};
