import assert from 'node:assert/strict';
import { Blob } from 'node:buffer';
import { Readable } from 'node:stream';
import { scheduler } from 'node:timers/promises';
import { types } from 'node:util';
import rekwest, {
  constants,
  Cookies,
  File,
  FormData,
  mediatypes,
  requestRedirect,
} from '../src/index.js';

const {
  HTTP2_HEADER_ACCEPT_ENCODING,
  HTTP2_HEADER_AUTHORIZATION,
  HTTP2_HEADER_CONTENT_DISPOSITION,
  HTTP2_HEADER_CONTENT_ENCODING,
  HTTP2_HEADER_CONTENT_TYPE,
  HTTP2_HEADER_RETRY_AFTER,
  HTTP2_HEADER_VARY,
  HTTP2_METHOD_GET,
  HTTP2_METHOD_HEAD,
  HTTP2_METHOD_POST,
  HTTP2_METHOD_PUT,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_MOVED_PERMANENTLY,
  HTTP_STATUS_NO_CONTENT,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
  HTTP_STATUS_PERMANENT_REDIRECT,
  HTTP_STATUS_SEE_OTHER,
  HTTP_STATUS_TOO_MANY_REQUESTS,
  HTTP_STATUS_UNAUTHORIZED,
} = constants;

const { TEXT_PLAIN } = mediatypes;

const encoder = new TextEncoder();

export default ({ baseURL, httpVersion }) => {
  describe('with { digest: true } & { parse: true } (defaults)', () => {

    after(() => Cookies.jar.clear());

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and must get a json`, async () => {
      const url = new URL('/gimme/json', baseURL);
      const res = await rekwest(url);

      assert.equal(res.body.message, 'json-bourne');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and must get a plain text`, async () => {
      const url = new URL('/gimme/text', baseURL);
      const res = await rekwest(url);

      assert.equal(res.body, 'message');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and must get an encoded text`, async () => {
      const url = new URL('/gimme/encode', baseURL);
      const res = await rekwest(url);

      assert.equal(res.body, '🙈🙉🙊');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request with cookies and must get new cookies`,
      async () => {
        const cookies = {
          aux: '🍪',
        };
        const url = new URL('/gimme/cookies', baseURL);
        const res = await rekwest(url, {
          cookies,
        });

        assert.equal(res.body.message, 'json-bourne');
        assert.deepEqual(res.body.reqCookies, cookies);
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies.get('aux'), '🍪');
        assert.equal(res.cookies.get('foo'), 'bar');
        assert.equal(res.cookies.get('baz'), 'qux');
        assert.equal(res.cookies.get('quoted'), '"alpha;beta;gamma"');
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(
      `should make ${ HTTP2_METHOD_GET } [${
        HTTP_STATUS_OK
      }] request and must get new cookie with 'expires' attribute`,
      async () => {
        const url = new URL('/gimme/cookies', baseURL);
        const res = await rekwest(url, {
          cookiesTTL: true,
          params: {
            expires: new Date(Date.now() + 1e3).toUTCString(),
          },
        });

        assert.equal(res.body.message, 'json-bourne');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies.get('ttl'), 'yank');
        await scheduler.wait(1.1e3);
        assert.equal(res.cookies.get('ttl'), null);
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(
      `should make ${ HTTP2_METHOD_GET } [${
        HTTP_STATUS_OK
      }] request and must get new cookie with positive (+) 'max-age' attribute`,
      async () => {
        const url = new URL('/gimme/cookies', baseURL);
        const res = await rekwest(url, {
          cookiesTTL: true,
          params: {
            maxAge: 1,
          },
        });

        assert.equal(res.body.message, 'json-bourne');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies.get('ttl'), 'yank');
        await scheduler.wait(1.1e3);
        assert.equal(res.cookies.get('ttl'), null);
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(
      `should make ${ HTTP2_METHOD_GET } [${
        HTTP_STATUS_OK
      }] request and must get new cookie with negative (-) 'max-age' attribute`,
      async () => {
        const url = new URL('/gimme/cookies', baseURL);
        const res = await rekwest(url, {
          cookiesTTL: true,
          params: {
            maxAge: -1,
          },
        });

        assert.equal(res.body.message, 'json-bourne');
        assert.equal(res.bodyUsed, true);
        await scheduler.wait(1);
        assert.equal(res.cookies.get('ttl'), null);
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request with new and preserved cookies`,
      async () => {
        const url = new URL('/gimme/cookies', baseURL);
        const res = await rekwest(url, {
          cookies: {
            zig: 'zag',
          },
        });

        assert.equal(res.body.message, 'json-bourne');
        assert.deepEqual(res.body.reqCookies, Object.fromEntries(res.cookies));
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies.get('aux'), '🍪');
        assert.equal(res.cookies.get('foo'), 'bar');
        assert.equal(res.cookies.get('baz'), 'qux');
        assert.equal(res.cookies.get('quoted'), '"alpha;beta;gamma"');
        assert.equal(res.cookies.get('ttl'), null);
        assert.equal(res.cookies.get('zig'), 'zag');
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_NO_CONTENT }] request without cookies`, async () => {
      const url = new URL('/gimme/nothing', baseURL);
      const res = await rekwest(url, { cookies: false });

      assert.equal(res.body, null);
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_NO_CONTENT);
    });

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request with body and must catch an error`, () => {
      const payload = 'zqiygyxz';
      const url = new URL('/gimme/text', baseURL);

      assert.throws(() => rekwest(url, { body: payload }), (err) => {
        assert.equal(
          err.message,
          `Request with ${ HTTP2_METHOD_GET }/${ HTTP2_METHOD_HEAD } method cannot have body`,
        );
        assert.equal(err.name, 'TypeError');

        return true;
      });
    });

    it(`should make ${ HTTP2_METHOD_GET } [${
      HTTP_STATUS_MOVED_PERMANENTLY
    }] request with redirect { credentials: false } and must catch an error`, () => {
      const url = new URL('/gimme/redirect', baseURL);

      assert.throws(() => rekwest(url, { credentials: false }), (err) => {
        assert.equal(
          err.message,
          'Failed to read the \'credentials\' property from \'options\': The provided value \'false\' is not a valid enum value',
        );
        assert.equal(err.name, 'TypeError');

        return true;
      });
    });

    it(`should make ${
      HTTP2_METHOD_GET
    } [${ HTTP_STATUS_MOVED_PERMANENTLY }] request with redirect { follow: 0 } and must catch an error`, async () => {
      const url = new URL('/gimme/redirect', baseURL);

      await assert.rejects(rekwest(url, { follow: 0 }), (err) => {
        assert.match(err.message, /Maximum redirect reached at:/);
        assert.equal(err.name, 'RequestError');

        return true;
      });
    });

    it(`should make ${ HTTP2_METHOD_GET } [${
      HTTP_STATUS_MOVED_PERMANENTLY
    }] request with redirect { mode: ${ requestRedirect.error } } and must catch an error`, async () => {
      const url = new URL('/gimme/redirect', baseURL);

      await assert.rejects(rekwest(url, { redirect: requestRedirect.error }), (err) => {
        assert.equal(err.message, 'Unexpected redirect, redirect mode is set to: error');
        assert.equal(err.name, 'RequestError');

        return true;
      });
    });

    it(`should make ${ HTTP2_METHOD_GET } [${
      HTTP_STATUS_MOVED_PERMANENTLY
    }] request with redirect { mode: false } and must catch an error`, () => {
      const url = new URL('/gimme/redirect', baseURL);

      assert.throws(() => rekwest(url, { redirect: false }), (err) => {
        assert.equal(
          err.message,
          'Failed to read the \'redirect\' property from \'options\': The provided value \'false\' is not a valid enum value',
        );
        assert.equal(err.name, 'TypeError');

        return true;
      });
    });

    it(
      `should make ${ HTTP2_METHOD_GET } [${
        HTTP_STATUS_MOVED_PERMANENTLY
      }] request with redirect { mode: ${ requestRedirect.follow } } and must retain a cookies`,
      async () => {
        const url = new URL('/gimme/redirect', baseURL);
        const res = await rekwest(url);

        assert.equal(res.body.message, 'json-bourne');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies.get('crack'), 'duck');
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, true);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(`should make ${ HTTP2_METHOD_GET } [${
      HTTP_STATUS_MOVED_PERMANENTLY
    }] request with redirect { mode: ${ requestRedirect.follow } } and must omit all creds`, async () => {
      const base = baseURL.protocol === 'http:' ? globalThis.h2sBaseURL : globalThis.h1sBaseURL;
      const url = new URL('/gimme/redirect', baseURL);
      const res = await rekwest(url, {
        headers: {
          [HTTP2_HEADER_AUTHORIZATION]: 'Bearer [token]',
        },
        params: {
          location: `${ base.origin }/gimme/json`,
        },
      });

      assert.equal(res.body.message, 'json-bourne');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.httpVersion, baseURL.protocol === 'http:' ? '2.0' : '1.1');
      assert.equal(res.ok, true);
      assert.equal(res.redirected, true);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_GET } [${
      HTTP_STATUS_MOVED_PERMANENTLY
    }] request with redirect { mode: ${ requestRedirect.manual } } and must get new cookies`, async () => {
      const url = new URL('/gimme/redirect', baseURL);
      const res = await rekwest(url, { redirect: requestRedirect.manual });

      assert.equal(res.body, null);
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies.get('crack'), 'duck');
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, false);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_MOVED_PERMANENTLY);
    });

    it(`should make ${ HTTP2_METHOD_GET } [${
      HTTP_STATUS_SEE_OTHER
    }] request with redirect and must catch an error on invalid protocol`, async () => {
      const url = new URL('/gimme/redirect', baseURL);

      await assert.rejects(rekwest(url, {
        params: {
          location: `wss://${ baseURL.host }`,
        },
      }), (err) => {
        assert.equal(err.message, 'URL scheme must be "http" or "https"');
        assert.equal(err.name, 'RequestError');

        return true;
      });
    });

    if (baseURL.protocol === 'https:') {
      it(`should make ${ HTTP2_METHOD_GET } [${
        HTTP_STATUS_MOVED_PERMANENTLY
      }] request with redirect and must prevent https downgrade`, async () => {
        const loc = new URL(`${ globalThis.h2cBaseURL.origin }/gimme/json`);
        const url = new URL('/gimme/redirect', baseURL);

        await assert.rejects(rekwest(url, {
          params: {
            location: loc,
          },
        }), (err) => {
          assert.equal(err.message, `Protocol downgrade detected, redirect from "${
            url.protocol
          }" to "${
            loc.protocol
          }": ${ loc }`);
          assert.equal(err.name, 'RequestError');

          return true;
        });
      });

      it(`should make ${ HTTP2_METHOD_GET } [${
        HTTP_STATUS_MOVED_PERMANENTLY
      }] request with redirect { allowDowngrade: true } and must receive a response`, async () => {
        const loc = new URL(`${ globalThis.h2cBaseURL.origin }/gimme/json`);
        const url = new URL('/gimme/redirect', baseURL);
        const res = await rekwest(url, {
          allowDowngrade: true,
          headers: {
            [HTTP2_HEADER_AUTHORIZATION]: 'Bearer [token]',
          },
          params: {
            location: loc,
          },
        });

        assert.equal(res.body.message, 'json-bourne');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies, undefined);
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, true);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      });
    }

    it(`should make ${ HTTP2_METHOD_GET } [${
      HTTP_STATUS_MOVED_PERMANENTLY
    }] request with redirect and must respect '${ HTTP2_HEADER_RETRY_AFTER }' header`, async () => {
      const url = new URL('/gimme/redirect', baseURL);
      const res = await rekwest(url, {
        params: {
          [HTTP2_HEADER_RETRY_AFTER]: 1,
        },
      });

      assert.equal(res.body.message, 'json-bourne');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies.get('crack'), 'duck');
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, true);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_POST } [${
      HTTP_STATUS_SEE_OTHER
    }] request with redirect { body: stream } and pass`, async () => {
      const payload = 'zqiygyxz';
      const url = new URL('/gimme/redirect', baseURL);
      const res = await rekwest(url, {
        body: Readable.from(payload),
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.message, 'json-bourne');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies.get('crack'), 'duck');
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, true);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_PUT } [${
      HTTP_STATUS_PERMANENT_REDIRECT
    }] request with redirect { body: stream } and must catch an error`, async () => {
      const payload = 'zqiygyxz';
      const url = new URL('/gimme/redirect', baseURL);

      await assert.rejects(rekwest(url, {
        body: Readable.from(payload),
        method: HTTP2_METHOD_PUT,
      }), (err) => {
        assert.equal(err.message, 'Unable to follow redirect with streamable body');
        assert.equal(err.name, 'RequestError');

        return true;
      });
    });

    it(`should make ${ HTTP2_METHOD_PUT } [${
      HTTP_STATUS_PERMANENT_REDIRECT
    }] request with redirect { body: stream, bufferBody: true } and pass`, async () => {
      const payload = 'zqiygyxz';
      const url = new URL('/gimme/redirect', baseURL);
      const res = await rekwest(url, {
        body: Readable.from(payload),
        bufferBody: true,
        method: HTTP2_METHOD_PUT,
      });

      assert.equal(res.body.toString(), payload);
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies.get('crack'), 'duck');
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, true);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_GET } [${
      HTTP_STATUS_OK
    }] request and must succeed after connection reset`, async () => {
      const url = new URL('/gimme/reset', baseURL);
      const res = await rekwest(url, {
        params: {
          attempts: 2,
        },
        retry: {
          attempts: 2,
          interval: 1,
        },
      });

      assert.equal(res.body.message, 'json-bourne');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies.get('crack'), 'duck');
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_GET } [${
      HTTP_STATUS_TOO_MANY_REQUESTS
    }] request and must succeed after '${ HTTP2_HEADER_RETRY_AFTER }' with date interval retry`, async () => {
      const url = new URL('/gimme/retry', baseURL);
      const res = await rekwest(url, {
        params: {
          [HTTP2_HEADER_RETRY_AFTER]: [
            1,
            new Date(),
          ],
          attempts: 2,
        },
        retry: { attempts: 2 },
      });

      assert.equal(res.body.message, 'json-bourne');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies.get('crack'), 'duck');
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_GET } [${
      HTTP_STATUS_TOO_MANY_REQUESTS
    }] request and must succeed after '${ HTTP2_HEADER_RETRY_AFTER }' with seconds interval retry`, async () => {
      const url = new URL('/gimme/retry', baseURL);
      const res = await rekwest(url, {
        params: {
          [HTTP2_HEADER_RETRY_AFTER]: 0,
          attempts: 2,
        },
        retry: { attempts: 2 },
      });

      assert.equal(res.body.message, 'json-bourne');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies.get('crack'), 'duck');
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_GET } [${
      HTTP_STATUS_TOO_MANY_REQUESTS
    }] request and must catch an error if max '${ HTTP2_HEADER_RETRY_AFTER }' limit is exceeded`, async () => {
      const url = new URL('/gimme/retry', baseURL);

      await assert.rejects(rekwest(url, {
        params: {
          [HTTP2_HEADER_RETRY_AFTER]: 3.5e5,
          attempts: 2,
        },
        retry: { attempts: 2 },
      }), (err) => {
        assert.ok(err.cause);
        assert.match(err.message, new RegExp(`Maximum '${ HTTP2_HEADER_RETRY_AFTER }' limit exceeded:`));
        assert.equal(err.name, 'RequestError');

        return true;
      });
    });

    it(`should make ${ HTTP2_METHOD_POST } [${
      HTTP_STATUS_NOT_FOUND
    }] request with retry and must catch an error on used stream`, async () => {
      const payload = 'zqiygyxz';
      const url = new URL('/gimme/void', baseURL);

      await assert.rejects(rekwest(url, {
        body: Readable.from(payload),
        method: HTTP2_METHOD_POST,
        retry: {
          attempts: 1,
          interval: 1,
          statusCodes: [HTTP_STATUS_NOT_FOUND],
        },
      }), (err) => {
        assert.equal(err.message, 'Request stream already read');
        assert.equal(err.name, 'RequestError');

        return true;
      });
    });

    it(`should make ${ HTTP2_METHOD_GET } [${
      HTTP_STATUS_TOO_MANY_REQUESTS
    }] request and must succeed after a log-uniform interval retry`, async () => {
      const url = new URL('/gimme/retry', baseURL);
      const res = await rekwest(url, {
        params: {
          attempts: 2,
        },
        retry: {
          attempts: 2,
          interval: 1,
        },
      });

      assert.equal(res.body.message, 'json-bourne');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies.get('crack'), 'duck');
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_UNAUTHORIZED }] request and must catch an error`,
      async () => {
        const url = new URL('/gimme/refusal', baseURL);

        await assert.rejects(rekwest(url), (res) => {
          assert.equal(res.body.message, 'unauthorized');
          assert.equal(res.bodyUsed, true);
          assert.equal(res.cookies.get('crack'), 'duck');
          assert.equal(res.httpVersion, httpVersion);
          assert.equal(res.ok, false);
          assert.equal(res.redirected, false);
          assert.equal(res.statusCode, HTTP_STATUS_UNAUTHORIZED);

          return true;
        });
      },
    );

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_NOT_FOUND }] request and must catch an error`, async () => {
      const url = new URL('/gimme/not/found', baseURL);

      await assert.rejects(rekwest(url), (res) => {
        assert.equal(res.body, null);
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies.get('crack'), 'duck');
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, false);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_NOT_FOUND);

        return true;
      });
    });

    it(
      `should make ${ HTTP2_METHOD_GET } [${
        HTTP_STATUS_NO_CONTENT
      }] request and must strip & trim extra slashes from the URL`,
      async () => {
        const url = new URL('/gimme///nothing///#meaningful', baseURL);
        const res = await rekwest(url, {
          stripTrailingSlash: true,
          trimTrailingSlashes: true,
        });

        assert.equal(res.body, null);
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies.get('crack'), 'duck');
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_NO_CONTENT);
      },
    );

    [
      'br',
      'deflate',
      'deflate-raw',
      'gzip',
      'zstd',
    ].forEach((item) => {
      it(
        `should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with '${ item }' encoded body`,
        async () => {
          const payload = 'zqiygyxz';
          const url = new URL('/gimme/squash', baseURL);
          const res = await rekwest(url, {
            body: payload,
            headers: {
              [HTTP2_HEADER_ACCEPT_ENCODING]: item,
              [HTTP2_HEADER_CONTENT_ENCODING]: item,
              [HTTP2_HEADER_CONTENT_TYPE]: TEXT_PLAIN,
              [HTTP2_HEADER_VARY]: '*',
            },
            method: HTTP2_METHOD_POST,
          });

          assert.equal(res.body, payload.split('').reverse().join(''));
          assert.equal(res.bodyUsed, true);
          assert.equal(res.httpVersion, httpVersion);
          assert.equal(res.ok, true);
          assert.equal(res.redirected, false);
          assert.equal(res.statusCode, HTTP_STATUS_OK);
        },
      );
    });

    [
      'br',
      'deflate',
      'deflate-raw',
      'gzip',
      'zstd',
    ].forEach((item) => {
      it(
        `should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with '${ item }' encoded body stream`,
        async () => {
          const payload = 'zqiygyxz';
          const url = new URL('/gimme/squash', baseURL);
          const res = await rekwest(url, {
            body: Readable.from(payload),
            headers: {
              [HTTP2_HEADER_ACCEPT_ENCODING]: item,
              [HTTP2_HEADER_CONTENT_ENCODING]: item,
              [HTTP2_HEADER_CONTENT_TYPE]: TEXT_PLAIN,
              [HTTP2_HEADER_VARY]: '*',
            },
            method: HTTP2_METHOD_POST,
          });

          assert.equal(res.body, payload.split('').reverse().join(''));
          assert.equal(res.bodyUsed, true);
          assert.equal(res.httpVersion, httpVersion);
          assert.equal(res.ok, true);
          assert.equal(res.redirected, false);
          assert.equal(res.statusCode, HTTP_STATUS_OK);
        },
      );
    });

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with nullish body`, async () => {
      const payload = null;
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: payload,
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body, payload);
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as an Array`, async () => {
      const payload = [{ eldritch: 'symbols' }];
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: payload,
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), JSON.stringify(payload));
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as an ArrayBuffer`, async () => {
      const payload = 'message';
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: encoder.encode(payload).buffer,
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), payload);
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as an ArrayBufferView`, async () => {
      const payload = 'message';
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: encoder.encode(payload),
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), payload);
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as an AsyncIterator`, async () => {
      const payload = {
        async* [Symbol.asyncIterator]() {
          yield Promise.resolve('eldritch');
          yield Promise.resolve('symbols');
        },
      };
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: payload,
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), (await Array.fromAsync(payload)).join(''));
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as a Blob`, async () => {
      const payload = new Blob(['bits']);
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: payload,
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), await payload.text());
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as a Buffer`, async () => {
      const payload = Buffer.from('zqiygyxz');
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: payload,
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), payload.toString());
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as a DataView`, async () => {
      const payload = 'message';
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: new DataView(encoder.encode(payload).buffer),
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), payload);
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as a File`, async () => {
      const payload = new File(['bits'], 'file.xyz');

      assert.throws(() => new File([]), TypeError);

      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: payload,
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), await payload.text());
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as a FormData`, async () => {
      const blob = new Blob(['bits']);
      const file = new File(['bits'], 'file.xyz');
      const readable = Readable.from('bits');
      const payload = new FormData({
        aux: Date.now(),
      });

      payload.append('celestial', 'payload');
      payload.append('blob', blob, 'blob.xyz');
      payload.append('file', file);
      payload.append('readable', readable, 'readable.xyz');

      payload.set('celestial', 'goddess');
      assert.equal(payload.has('celestial'), true);
      assert.deepEqual(payload.getAll('celestial'), ['goddess']);

      payload.delete('celestial');
      assert.equal(payload.has('celestial'), false);

      payload.append('celestial', 'goddess');
      assert.equal(payload.get('celestial'), 'goddess');

      payload.set('celestial', 'payload');
      assert.equal(payload.get('celestial'), 'payload');

      const keys = [...payload.keys()];
      const values = [...payload.values()];

      payload.forEach((val, key) => {
        assert.equal(val, values.shift());
        assert.equal(key, keys.shift());
      });

      assert.throws(() => new FormData([null]), TypeError);
      assert.throws(() => new FormData([[]]), TypeError);
      assert.throws(() => payload.append(), TypeError);
      assert.throws(() => payload.append(null, null, null), TypeError);
      assert.throws(() => payload.delete(), TypeError);
      assert.throws(() => payload.forEach(), TypeError);
      assert.throws(() => payload.forEach(null), TypeError);
      assert.throws(() => payload.get(), TypeError);
      assert.throws(() => payload.getAll(), TypeError);
      assert.throws(() => payload.has(), TypeError);
      assert.throws(() => payload.set(), TypeError);
      assert.throws(() => payload.set(null, null, null), TypeError);

      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: payload,
        method: HTTP2_METHOD_POST,
      });

      assert.deepEqual([
        ...res.body.toString()
              .matchAll(new RegExp(`${
                HTTP2_HEADER_CONTENT_DISPOSITION
              }: form-data; name="([^"]*)"(?:; filename="([^"]*)")?`, 'g')),
      ].flatMap((it) => it.slice(1).filter(Boolean)), [
        'aux',
        'blob',
        'blob.xyz',
        'file',
        'file.xyz',
        'readable',
        'readable.xyz',
        'celestial',
      ]);
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as an Iterator`, async () => {
      const payload = {
        * [Symbol.iterator]() {
          yield 'eldritch';
          yield 'symbols';
        },
      };
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: payload,
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), [...payload].join(''));
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as an Object`, async () => {
      const payload = { eldritch: 'symbols' };
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: payload,
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), JSON.stringify(payload));
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as a String`, async () => {
      const payload = 'zqiygyxz';
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: payload,
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), payload);
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as a Readable`, async () => {
      const payload = 'zqiygyxz';
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: Readable.from(payload),
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), payload);
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as a ReadableStream`, async () => {
      const payload = 'zqiygyxz';
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(payload);
            controller.close();
          },
        }),
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), payload);
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(
      `should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as a SharedArrayBuffer (Uint8Array)`,
      async () => {
        const payload = 'message';
        const data = encoder.encode(payload);
        const sab = new SharedArrayBuffer(data.length);
        const tie = new Uint8Array(sab);

        tie.set(data, 0);

        const url = new URL('/gimme/repulse', baseURL);
        const res = await rekwest(url, {
          body: sab,
          method: HTTP2_METHOD_POST,
        });

        assert.equal(res.body.toString(), payload);
        assert.equal(res.bodyUsed, true);
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as a URLSearchParams`, async () => {
      const payload = new URLSearchParams([
        [
          'eldritch',
          'symbols',
        ],
        [
          'ley',
          'lines',
        ],
      ]);
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: payload,
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), payload.toString());
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

  });

  describe('with { digest: false } & { parse: false }', () => {

    const options = { digest: false, parse: false };

    it(
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and must read response via 'arrayBuffer' method`,
      async () => {
        const url = new URL('/gimme/text', baseURL);
        const res = await rekwest(url, options);

        assert.ok(types.isArrayBuffer(await res.arrayBuffer()));
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies, undefined);
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and must read response via 'blob' method`,
      async () => {
        const url = new URL('/gimme/text', baseURL);
        const res = await rekwest(url, options);

        assert.ok((await res.blob())?.constructor.name === 'Blob');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies, undefined);
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and must read response via 'body' method`,
      async () => {
        const url = new URL('/gimme/text', baseURL);
        const res = await rekwest(url, options);

        assert.ok(Buffer.isBuffer(await res.body()));
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies, undefined);
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and must read response via 'bytes' method`,
      async () => {
        const url = new URL('/gimme/text', baseURL);
        const res = await rekwest(url, options);

        assert.ok(types.isUint8Array(await res.bytes()));
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies, undefined);
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );


    it(
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and must read response via 'json' method`,
      async () => {
        const url = new URL('/gimme/json', baseURL);
        const res = await rekwest(url, options);

        assert.equal((await res.json()).message, 'json-bourne');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies, undefined);
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and must read response via 'text' method`,
      async () => {
        const url = new URL('/gimme/text', baseURL);
        const res = await rekwest(url, options);

        assert.equal(await res.text(), 'message');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies, undefined);
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(
      `should make ${ HTTP2_METHOD_GET } [${
        HTTP_STATUS_OK
      }] request and must catch an error in attempt to re-read the response`,
      async () => {
        const url = new URL('/gimme/text', baseURL);
        const res = await rekwest(url, options);

        assert.ok(Buffer.isBuffer(await res.body()));

        await assert.rejects(res.body(), (err) => {
          assert.equal(err.message, 'Response stream already read');
          assert.equal(err.name, 'TypeError');

          return true;
        });
      },
    );

  });

  describe('with abort { signal }', () => {

    it(
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and must catch an error after the abort signal`,
      async () => {
        const ac = new AbortController();
        const url = new URL('/gimme/nothing', baseURL);

        setImmediate(() => ac.abort());

        await assert.rejects(rekwest(url, { signal: ac.signal }), (err) => {
          assert.equal(err.message, 'The operation was aborted');
          assert.equal(err.name, 'AbortError');

          return true;
        });
      },
    );

  });

  describe('with { thenable: true }', () => {

    it(
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_INTERNAL_SERVER_ERROR }] request and must slip an error`,
      async () => {
        const url = new URL('/gimme/kaboom', baseURL);
        const res = await rekwest(url, { thenable: true });

        assert.equal(res.body.message, 'kaboom');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies, undefined);
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, false);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_INTERNAL_SERVER_ERROR);
      },
    );

  });

};
