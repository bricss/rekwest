import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import { requestRedirect } from './constants.mjs';
import defaults from './defaults.mjs';
import { APPLICATION_OCTET_STREAM } from './mediatypes.mjs';
import { preflight } from './preflight.mjs';
import { transfer } from './transfer.mjs';
import {
  admix,
  affix,
  merge,
  normalize,
} from './utils.mjs';
import { validation } from './validation.mjs';

export { constants } from 'node:http2';

export * from './ackn.mjs';
export * from './constants.mjs';
export * from './cookies.mjs';
export * from './errors.mjs';
export * from './file.mjs';
export * from './formdata.mjs';
export * as mediatypes from './mediatypes.mjs';
export * from './mixin.mjs';
export * from './utils.mjs';
export * from './validation.mjs';

const {
  HTTP2_HEADER_CONTENT_TYPE,
} = http2.constants;

export default function rekwest(url, options) {
  return transfer(validation(normalize(url, options)), rekwest);
}

Reflect.defineProperty(rekwest, 'defaults', {
  enumerable: true,
  get() { return defaults.stash; },
  set(value) { defaults.stash = merge(defaults.stash, value); },
});

Reflect.defineProperty(rekwest, 'extend', {
  enumerable: true,
  value(options) {
    return (url, opts) => rekwest(url, merge(options, opts));
  },
});

Reflect.defineProperty(rekwest, 'stream', {
  enumerable: true,
  value(url, options) {
    options = preflight(validation(normalize(url, merge(options, {
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

    affix(client, req, options);

    req.once('response', (res) => {
      let headers;

      if (options.h2) {
        headers = res;
        res = req;
      }

      admix(res, headers, options);
    });

    return req;
  },
});
