import { strict as assert } from 'node:assert';
import { Blob } from 'node:buffer';
import { Readable } from 'node:stream';
import { scheduler } from 'node:timers/promises';
import { types } from 'node:util';
import {
  requestCredentials,
  requestRedirect,
} from '../src/constants.mjs';
import rekwest, {
  constants,
  Cookies,
  File,
  FormData,
} from '../src/index.mjs';
import { TEXT_PLAIN } from '../src/mediatypes.mjs';

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
  HTTP_STATUS_FOUND,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_MOVED_PERMANENTLY,
  HTTP_STATUS_NO_CONTENT,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
  HTTP_STATUS_SEE_OTHER,
  HTTP_STATUS_TOO_MANY_REQUESTS,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_USE_PROXY,
} = constants;

const logarithmic = 'logarithmic';
const encoder = new TextEncoder();

export default ({ baseURL, httpVersion }) => {
  describe('with { digest: true } & { parse: true } (defaults)', () => {

    after(() => Cookies.jar.clear());

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and must get a json`, async () => {
      const url = new URL('/gimme/json', baseURL);
      const res = await rekwest(url);

      assert.equal(res.body.message, 'json');
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
        const url = new URL('/gimme/cookies', baseURL);
        const res = await rekwest(url, {
          cookies: {
            aux: 'baz',
          },
        });

        assert.equal(res.body.message, 'json');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies.get('aux'), 'baz');
        assert.equal(res.cookies.get('foo'), 'bar');
        assert.equal(res.cookies.get('qux'), 'zap');
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
        const url = new URL(`/gimme/cookies?expires=${ new Date(Date.now() + 1e3).toGMTString() }`, baseURL);
        const res = await rekwest(url, {
          cookiesTTL: true,
        });

        assert.equal(res.body.message, 'json');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies.get('ttl'), 'puff');
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
        const url = new URL(`/gimme/cookies?maxAge=${ 1 }`, baseURL);
        const res = await rekwest(url, {
          cookiesTTL: true,
        });

        assert.equal(res.body.message, 'json');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies.get('ttl'), 'puff');
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
        const url = new URL(`/gimme/cookies?maxAge=${ -1 }`, baseURL);
        const res = await rekwest(url, {
          cookiesTTL: true,
        });

        assert.equal(res.body.message, 'json');
        assert.equal(res.bodyUsed, true);
        await scheduler.wait(100);
        assert.equal(res.cookies.get('ttl'), null);
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_NO_CONTENT }] request with new and preserved cookies`,
      async () => {
        const url = new URL('/gimme/nothing', baseURL);
        const res = await rekwest(url, {
          cookies: {
            xen: 'wix',
          },
        });

        assert.equal(res.body, null);
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies.get('aux'), 'baz');
        assert.equal(res.cookies.get('foo'), 'bar');
        assert.equal(res.cookies.get('qux'), 'zap');
        assert.equal(res.cookies.get('ttl'), null);
        assert.equal(res.cookies.get('xen'), 'wix');
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_NO_CONTENT);
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

    it(
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request with body and must catch an error`,
      async () => {
        const url = new URL('/gimme/text', baseURL);

        await assert.throws(() => rekwest(url, { body: 'zqiygyxz' }), (err) => {
          assert.equal(
            err.message,
            `Request with ${ HTTP2_METHOD_GET }/${ HTTP2_METHOD_HEAD } method cannot have body.`,
          );
          assert.equal(err.name, 'TypeError');

          return true;
        });
      },
    );

    it(`should make ${ HTTP2_METHOD_GET } [${
      HTTP_STATUS_MOVED_PERMANENTLY
    }] request with redirect { credentials: false } and must catch an error`, async () => {
      const url = new URL('/gimme/redirect', baseURL);

      await assert.throws(() => rekwest(url, { credentials: false }), (err) => {
        assert.equal(
          err.message,
          'Failed to read the \'credentials\' property from \'options\': The provided value \'false\' is not a valid enum value.',
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
        assert.equal(err.message, 'Unexpected redirect, redirect mode is set to \'error\'.');
        assert.equal(err.name, 'RequestError');

        return true;
      });
    });

    it(`should make ${ HTTP2_METHOD_GET } [${
      HTTP_STATUS_MOVED_PERMANENTLY
    }] request with redirect { mode: false } and must catch an error`, async () => {
      const url = new URL('/gimme/redirect', baseURL);

      await assert.throws(() => rekwest(url, { redirect: false }), (err) => {
        assert.equal(
          err.message,
          'Failed to read the \'redirect\' property from \'options\': The provided value \'false\' is not a valid enum value.',
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

        assert.equal(res.body.message, 'json');
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
    }] request with redirect { mode: ${ requestRedirect.follow } } and must omit all cookies`, async () => {
      const base = baseURL.protocol === 'http:' ? globalThis.baseB1URL : globalThis.baseB2URL;
      const url = new URL(`/gimme/redirect?location=${ base.origin }/gimme/json`, baseURL);
      const res = await rekwest(url, {
        credentials: requestCredentials.omit,
        headers: {
          [HTTP2_HEADER_AUTHORIZATION]: 'token',
        },
        redirect: requestRedirect.follow,
      });

      assert.equal(res.body.message, 'json');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.httpVersion, httpVersion);
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
      const url = new URL(`/gimme/redirect?location=wss://${ baseURL.host }`, baseURL);

      await assert.rejects(rekwest(url), (err) => {
        assert.equal(err.message, 'URL scheme must be "http" or "https".');
        assert.equal(err.name, 'RequestError');

        return true;
      });
    });

    it(`should make ${ HTTP2_METHOD_GET } [${
      HTTP_STATUS_USE_PROXY
    }] request with redirect and must catch an error on inapt status code`, async () => {
      const url = new URL(`/gimme/redirect?statusCode=${ HTTP_STATUS_USE_PROXY }`, baseURL);

      await assert.rejects(rekwest(url), (err) => {
        assert.equal(err.message, `Invalid status code: ${ HTTP_STATUS_USE_PROXY }`);
        assert.equal(err.name, 'RangeError');

        return true;
      });
    });

    it(`should make ${ HTTP2_METHOD_GET } [${
      HTTP_STATUS_MOVED_PERMANENTLY
    }] request with redirect and must respect '${ HTTP2_HEADER_RETRY_AFTER }' header`, async () => {
      const url = new URL(`/gimme/redirect?${ HTTP2_HEADER_RETRY_AFTER }=0.25`, baseURL);
      const res = await rekwest(url);

      assert.equal(res.body.message, 'json');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies.get('crack'), 'duck');
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, true);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(
      `should make ${ HTTP2_METHOD_GET } [${
        HTTP_STATUS_MOVED_PERMANENTLY
      }] request with redirect and must catch an error if max '${ HTTP2_HEADER_RETRY_AFTER }' limit is exceeded`,
      async () => {
        const url = new URL(`/gimme/redirect?${ HTTP2_HEADER_RETRY_AFTER }=3.5e5`, baseURL);

        await assert.rejects(rekwest(url), (err) => {
          assert.ok(err.cause);
          assert.match(err.message, new RegExp(`Maximum '${ HTTP2_HEADER_RETRY_AFTER }' limit exceeded:`));
          assert.equal(err.name, 'RequestError');

          return true;
        });
      },
    );

    it(`should make ${ HTTP2_METHOD_POST } [${
      HTTP_STATUS_FOUND
    }] request with redirect { body: stream } and must catch an error`, async () => {
      const url = new URL('/gimme/redirect', baseURL);

      await assert.rejects(rekwest(url, {
        body: Readable.from('zqiygyxz'),
        method: HTTP2_METHOD_POST,
      }), (err) => {
        assert.equal(err.message, 'Unable to follow redirect with streamable body.');
        assert.equal(err.name, 'RequestError');

        return true;
      });
    });

    it(`should make ${ HTTP2_METHOD_PUT } [${
      HTTP_STATUS_SEE_OTHER
    }] request with redirect { body: json }`, async () => {
      const url = new URL('/gimme/redirect', baseURL);
      const res = await rekwest(url, {
        body: { eldritch: 'symbols' },
        method: HTTP2_METHOD_PUT,
      });

      assert.equal(res.body.message, 'json');
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
      const url = new URL(
        '/gimme/reset?attempts=2',
        baseURL,
      );
      const res = await rekwest(url, { retry: { attempts: 2, interval: 25 } });

      assert.equal(res.body.message, 'json');
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
      const url = new URL(
        `/gimme/retry?attempts=2&${ HTTP2_HEADER_RETRY_AFTER }=date:0.5&ver=${ httpVersion }`,
        baseURL,
      );
      const res = await rekwest(url, { retry: { attempts: 2 } });

      assert.equal(res.body.message, 'json');
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
      const url = new URL(
        `/gimme/retry?attempts=2&${ HTTP2_HEADER_RETRY_AFTER }=0.25&ver=${ httpVersion }`,
        baseURL,
      );
      const res = await rekwest(url, { retry: { attempts: 2 } });

      assert.equal(res.body.message, 'json');
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
      const url = new URL(
        `/gimme/retry?attempts=2&${ HTTP2_HEADER_RETRY_AFTER }=3.5e5&ver=${ httpVersion }`,
        baseURL,
      );

      await assert.rejects(rekwest(url, { retry: { attempts: 2 } }), (err) => {
        assert.ok(err.cause);
        assert.match(err.message, new RegExp(`Maximum '${ HTTP2_HEADER_RETRY_AFTER }' limit exceeded:`));
        assert.equal(err.name, 'RequestError');

        return true;
      });
    });

    it(`should make ${ HTTP2_METHOD_GET } [${
      HTTP_STATUS_TOO_MANY_REQUESTS
    }] request and must succeed after a ${ logarithmic } interval retry`, async () => {
      const url = new URL(`/gimme/retry?attempts=2&${ logarithmic }=true&ver=${ httpVersion }`, baseURL);
      const res = await rekwest(url, { retry: { attempts: 2, interval: 100 } });

      assert.equal(res.body.message, 'json');
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
        const url = new URL('/gimme///nothing///#bang', baseURL);
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
        `should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with '${ item }' compressed body`,
        async () => {
          const url = new URL('/gimme/squash', baseURL);
          const res = await rekwest(url, {
            body: 'zqiygyxz',
            headers: {
              [HTTP2_HEADER_ACCEPT_ENCODING]: item,
              [HTTP2_HEADER_CONTENT_ENCODING]: item,
              [HTTP2_HEADER_CONTENT_TYPE]: TEXT_PLAIN,
              [HTTP2_HEADER_VARY]: [HTTP2_HEADER_ACCEPT_ENCODING],
            },
            method: HTTP2_METHOD_POST,
          });

          assert.equal(res.body, 'zqiygyxz'.split('').reverse().join(''));
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
        `should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with '${ item }' compressed body stream`,
        async () => {
          const url = new URL('/gimme/squash', baseURL);
          const res = await rekwest(url, {
            body: Readable.from('zqiygyxz'),
            headers: {
              [HTTP2_HEADER_ACCEPT_ENCODING]: item,
              [HTTP2_HEADER_CONTENT_ENCODING]: item,
              [HTTP2_HEADER_CONTENT_TYPE]: TEXT_PLAIN,
              [HTTP2_HEADER_VARY]: [HTTP2_HEADER_ACCEPT_ENCODING],
            },
            method: HTTP2_METHOD_POST,
          });

          assert.equal(res.body, 'zqiygyxz'.split('').reverse().join(''));
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

      assert.equal(res.body.toString(), await (async function () {
        const chunks = [];

        for await (const chunk of payload) {
          chunks.push(chunk);
        }

        return chunks.join('');
      }()));
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
      const payload = new File(['bits'], 'file.dab');

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
      const file = new File(['bits'], 'file.dab');
      const readable = Readable.from('bits');
      const payload = new FormData({
        aux: Date.now(),
      });

      payload.append('celestial', 'payload');
      payload.append('blob', blob, 'blob.dab');
      payload.append('file', file);
      payload.append('readable', readable, 'readable.dab');

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

      payload.forEach((value, key) => {
        assert.equal(value, values.shift());
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
        'blob.dab',
        'file',
        'file.dab',
        'readable',
        'readable.dab',
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
      const payload = new URLSearchParams('eldritch=symbols&ley=lines');
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

        assert.equal((await res.json()).message, 'json');
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
