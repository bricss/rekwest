import http2 from 'node:http2';
import {
  requestCredentials,
  requestRedirect,
} from './constants.js';

const {
  HTTP2_METHOD_GET,
  HTTP2_METHOD_HEAD,
} = http2.constants;

export const validation = (options = {}) => {
  if (options.body && [
    HTTP2_METHOD_GET,
    HTTP2_METHOD_HEAD,
  ].includes(options.method)) {
    throw new TypeError(`Request with ${ HTTP2_METHOD_GET }/${ HTTP2_METHOD_HEAD } method cannot have body.`);
  }

  if (!Object.values(requestCredentials).includes(options.credentials)) {
    throw new TypeError(`Failed to read the 'credentials' property from 'options': The provided value '${
      options.credentials
    }' is not a valid enum value.`);
  }

  if (!Reflect.has(requestRedirect, options.redirect)) {
    throw new TypeError(`Failed to read the 'redirect' property from 'options': The provided value '${
      options.redirect
    }' is not a valid enum value.`);
  }

  return options;
};
