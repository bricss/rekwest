import { strict as assert } from 'assert';
import { Blob } from 'buffer';
import { Readable } from 'stream';
import { types } from 'util';
import rekwest, {
  constants,
  Cookies,
} from '../src/index.mjs';

const {
        HTTP2_HEADER_ACCEPT_ENCODING,
        HTTP2_HEADER_CONTENT_ENCODING,
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
        HTTP_STATUS_UNAUTHORIZED,
      } = constants;

export default ({ baseURL, httpVersion }) => {
  describe('with { digest: true } & { parse: true } (defaults)', () => {

    after(() => Cookies.jar.clear());

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and get a json`, async () => {
      const url = new URL('/gimme/json', baseURL);
      const res = await rekwest(url);

      assert.equal(res.body.gotta, 'json');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and get a plain text`, async () => {
      const url = new URL('/gimme/text', baseURL);
      const res = await rekwest(url);

      assert.equal(res.body, 'gotta text');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and get an encoded text`, async () => {
      const url = new URL('/gimme/encode', baseURL);
      const res = await rekwest(url);

      assert.equal(res.body, '杯瑴愠瑥硴');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request with cookies and get more cookies`,
      async () => {
        const url = new URL('/gimme/cookies', baseURL);
        const res = await rekwest(url, {
          cookies: {
            aux: 'baz',
          },
        });

        assert.equal(res.body.gotta, 'cookies');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies?.aux, 'baz');
        assert.equal(res.cookies?.foo, 'bar');
        assert.equal(res.cookies?.qux, 'zap');
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
            dot: 'com',
          },
        });

        assert.equal(res.body.length, 0);
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies?.aux, 'baz');
        assert.equal(res.cookies?.dot, 'com');
        assert.equal(res.cookies?.foo, 'bar');
        assert.equal(res.cookies?.qux, 'zap');
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_NO_CONTENT);
      },
    );

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_NO_CONTENT }] request without cookies`, async () => {
      const url = new URL('/gimme/nothing', baseURL);
      const res = await rekwest(url, { cookies: false });

      assert.equal(res.body.length, 0);
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_NO_CONTENT);
    });

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request with body and catch error`, async () => {
      const url = new URL('/gimme/text', baseURL);

      await assert.rejects(rekwest(url, { body: 'payload' }), (err) => {
        assert.match(
          err.message,
          new RegExp(`Request with ${ HTTP2_METHOD_GET }/${ HTTP2_METHOD_HEAD } method cannot have body`),
        );
        assert.equal(err.name, 'TypeError');

        return true;
      });
    });

    it(
      `should make ${
        HTTP2_METHOD_GET
      } [${ HTTP_STATUS_MOVED_PERMANENTLY }] request with redirect { follow: 0 } and catch error`,
      async () => {
        const url = new URL('/gimme/redirect', baseURL);

        await assert.rejects(rekwest(url, { follow: 0 }), (err) => {
          assert.match(err.message, /Maximum redirect reached at:/);
          assert.equal(err.name, 'RequestError');

          return true;
        });
      },
    );

    it(
      `should make ${
        HTTP2_METHOD_GET
      } [${ HTTP_STATUS_MOVED_PERMANENTLY }] request with redirect { mode: error } and catch error`,
      async () => {
        const url = new URL('/gimme/redirect', baseURL);

        await assert.rejects(rekwest(url, { redirect: 'error' }), (err) => {
          assert.match(err.message, /Unexpected redirect, redirect mode is set to error/);
          assert.equal(err.name, 'RequestError');

          return true;
        });
      },
    );

    it(
      `should make ${
        HTTP2_METHOD_GET
      } [${ HTTP_STATUS_MOVED_PERMANENTLY }] request with redirect { mode: false } and get new cookies`,
      async () => {
        const url = new URL('/gimme/redirect', baseURL);
        const res = await rekwest(url, { redirect: false });

        assert.equal(res.body.length, 0);
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies?.crack, 'duck');
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, false);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_MOVED_PERMANENTLY);
      },
    );

    it(
      `should make ${
        HTTP2_METHOD_GET
      } [${ HTTP_STATUS_MOVED_PERMANENTLY }] request with redirect { mode: follow } and retain cookies`,
      async () => {
        const url = new URL('/gimme/redirect', baseURL);
        const res = await rekwest(url);

        assert.equal(res.body.gotta, 'json');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies?.crack, 'duck');
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, true);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(
      `should make ${
        HTTP2_METHOD_POST
      } [${ HTTP_STATUS_FOUND }] request with redirect { body: stream } and catch error`,
      async () => {
        const url = new URL('/gimme/redirect', baseURL);

        await assert.rejects(rekwest(url, {
          body: Readable.from(Array.from('zqiygyxz')),
          method: HTTP2_METHOD_POST,
        }), (err) => {
          assert.match(err.message, /Unable to follow redirect with body as readable stream/);
          assert.equal(err.name, 'RequestError');

          return true;
        });
      },
    );

    it(
      `should make ${ HTTP2_METHOD_PUT } [${ HTTP_STATUS_SEE_OTHER }] request with redirect { body: json }`,
      async () => {
        const url = new URL('/gimme/redirect', baseURL);
        const res = await rekwest(url, {
          body: { eldritch: 'symbols' },
          method: HTTP2_METHOD_PUT,
        });

        assert.equal(res.body.gotta, 'json');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies?.crack, 'duck');
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, true);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_UNAUTHORIZED }] request and catch error`, async () => {
      const url = new URL('/gimme/refusal', baseURL);

      await assert.rejects(rekwest(url), (res) => {
        assert.equal(res.body.message, 'unauthorized');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies?.crack, 'duck');
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, false);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_UNAUTHORIZED);

        return true;
      });
    });

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_NOT_FOUND }] request and catch error`, async () => {
      const url = new URL('/gimme/puff', baseURL);

      await assert.rejects(rekwest(url), (res) => {
        assert.equal(res.body.length, 0);
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies?.crack, 'duck');
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, false);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_NOT_FOUND);

        return true;
      });
    });

    [
      'br',
      'deflate',
      'gzip',
      'identity',
    ].forEach((item) => {
      it(
        `should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with "${ item }" compressed body`,
        async () => {
          const url = new URL('/gimme/squash', baseURL);
          const res = await rekwest(url, {
            body: Buffer.from('zqiygyxz'),
            headers: {
              [HTTP2_HEADER_ACCEPT_ENCODING]: item,
              [HTTP2_HEADER_CONTENT_ENCODING]: item,
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

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as a blob`, async () => {
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: new Blob(['blob']),
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), 'blob');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as a query`, async () => {
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: new URLSearchParams('foo=bar'),
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), 'foo=bar');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

  });

  describe('with { digest: false } & { parse: false }', () => {

    const opts = { digest: false, parse: false };

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and resolve to arrayBuffer`, async () => {
      const url = new URL('/gimme/text', baseURL);
      const res = await rekwest(url, opts);

      assert.ok(types.isArrayBuffer(await res.arrayBuffer()));
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    (parseFloat(process.versions.node) >= 16
     ? it
     : it.skip)(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and resolve to blob`, async () => {
      const url = new URL('/gimme/text', baseURL);
      const res = await rekwest(url, opts);

      assert.ok((await res.blob())?.constructor.name === 'Blob');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and resolve to buffer`, async () => {
      const url = new URL('/gimme/text', baseURL);
      const res = await rekwest(url, opts);

      assert.ok(Buffer.isBuffer(await res.body()));
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and resolve to json`, async () => {
      const url = new URL('/gimme/json', baseURL);
      const res = await rekwest(url, opts);

      assert.equal((await res.json()).gotta, 'json');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and resolve to text`, async () => {
      const url = new URL('/gimme/text', baseURL);
      const res = await rekwest(url, opts);

      assert.equal(await res.text(), 'gotta text');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

  });

  describe('with { thenable: true }', () => {

    it(
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_INTERNAL_SERVER_ERROR }] request and slip the error`,
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
