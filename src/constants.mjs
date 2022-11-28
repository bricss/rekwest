import http2 from 'node:http2';

const {
  HTTP_STATUS_FOUND,
  HTTP_STATUS_MOVED_PERMANENTLY,
  HTTP_STATUS_PERMANENT_REDIRECT,
  HTTP_STATUS_SEE_OTHER,
  HTTP_STATUS_TEMPORARY_REDIRECT,
} = http2.constants;

export const redirectModes = {
  error: 'error',
  follow: 'follow',
  manual: 'manual',
};

export const redirectStatusCodes = [
  HTTP_STATUS_MOVED_PERMANENTLY,
  HTTP_STATUS_FOUND,
  HTTP_STATUS_SEE_OTHER,
  HTTP_STATUS_TEMPORARY_REDIRECT,
  HTTP_STATUS_PERMANENT_REDIRECT,
];
