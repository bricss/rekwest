import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import { requestRedirect } from './constants.mjs';
import defaults from './defaults.mjs';
import { APPLICATION_OCTET_STREAM } from './mediatypes.mjs';
import { preflight } from './preflight.mjs';
import {
  admix,
  affix,
  merge,
  normalize,
  transfer,
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

export default function rekwest(...args) {
  let options = normalize(...args);

  if (!options.redirected) {
    options = merge(rekwest.defaults, options);
  }

  return transfer(validation(options));
}

Reflect.defineProperty(rekwest, 'stream', {
  enumerable: true,
  value(...args) {
    const options = preflight({
      ...validation(merge(rekwest.defaults, {
        headers: { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_OCTET_STREAM },
      }, normalize(...args))),
      redirect: requestRedirect.manual,
    });

    const { h2, url } = options;
    let client, req;

    if (h2) {
      client = http2.connect(url.origin, options);
      req = client.request(options.headers, options);
    } else {
      const { request } = (url.protocol === 'http:' ? http : https);

      req = request(url, options);
    }

    affix(client, req, options);

    req.once('response', (res) => {
      let headers;

      if (h2) {
        headers = res;
        res = req;
      }

      admix(res, headers, options);
    });

    return req;
  },
});

Reflect.defineProperty(rekwest, 'defaults', {
  enumerable: true,
  get() { return defaults.stash; },
  set(value) { defaults.stash = merge(defaults.stash, value); },
});
