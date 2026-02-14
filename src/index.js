import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import config from './config.js';
import { requestRedirect } from './constants.js';
import { APPLICATION_OCTET_STREAM } from './mediatypes.js';
import { preflight } from './preflight.js';
import { transfer } from './transfer.js';
import {
  augment,
  cloneWith,
  normalize,
  snoop,
} from './utils.js';
import { validation } from './validation.js';

export {
  Blob,
  File,
} from 'node:buffer';
export { constants } from 'node:http2';
export * from './ackn.js';
export * from './codecs.js';
export * from './constants.js';
export * from './cookies.js';
export * from './errors.js';
export * from './formdata.js';
export * as mediatypes from './mediatypes.js';
export * from './mixin.js';
export * from './utils.js';
export * from './validation.js';

const {
  HTTP2_HEADER_CONTENT_TYPE,
} = http2.constants;

export default function rekwest(url, options) {
  return transfer(validation(normalize(url, options)));
}

Reflect.defineProperty(rekwest, 'defaults', {
  enumerable: true,
  get() { return config.defaults; },
  set(val) { config.defaults = cloneWith(config.defaults, val); },
});

Reflect.defineProperty(rekwest, 'extend', {
  enumerable: true,
  value(options) {
    return (url, opts) => rekwest(url, cloneWith(options, opts));
  },
});

Reflect.defineProperty(rekwest, 'stream', {
  enumerable: true,
  value(url, options) {
    options = preflight(validation(normalize(url, cloneWith({}, options, {
      headers: { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_OCTET_STREAM },
      redirect: requestRedirect.manual,
    }))));
    let client, req;

    if (options.h2) {
      client = http2.connect(options.url.origin, options);
      req = client.request(options.headers, options);
    } else {
      const { request } = options.url.protocol === 'http:' ? http : https;

      req = request(options.url, options);
    }

    snoop(client, req, options);

    req.once('response', (res) => {
      let headers;

      if (options.h2) {
        headers = res;
        res = req;
      }

      augment(res, headers, options);
    });

    return req;
  },
});
