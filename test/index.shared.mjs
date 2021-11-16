import { strict as assert } from 'assert';
import { Blob } from 'buffer';
import { Readable } from 'stream';
import { types } from 'util';
import rekwest, {
  constants,
  Cookies,
  File,
  FormData,
} from '../src/index.mjs';
import { TEXT_PLAIN } from '../src/mediatypes.mjs';

const {
  HTTP2_HEADER_ACCEPT_ENCODING,
  HTTP2_HEADER_CONTENT_DISPOSITION,
  HTTP2_HEADER_CONTENT_ENCODING,
  HTTP2_HEADER_CONTENT_TYPE,
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

      assert.equal(res.body.got, 'json');
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

      assert.equal(res.body, 'got text');
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

      assert.equal(res.body, '杯琠瑥硴');
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

        assert.equal(res.body.got, 'cookies');
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
        assert.equal(res.cookies.get('aux'), 'baz');
        assert.equal(res.cookies.get('dot'), 'com');
        assert.equal(res.cookies.get('foo'), 'bar');
        assert.equal(res.cookies.get('qux'), 'zap');
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

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request with body and catch an error`, async () => {
      const url = new URL('/gimme/text', baseURL);

      await assert.rejects(rekwest(url, { body: 'zqiygyxz' }), (err) => {
        assert.equal(
          err.message,
          `Request with ${ HTTP2_METHOD_GET }/${ HTTP2_METHOD_HEAD } method cannot have body`,
        );
        assert.equal(err.name, 'TypeError');

        return true;
      });
    });

    it(
      `should make ${
        HTTP2_METHOD_GET
      } [${ HTTP_STATUS_MOVED_PERMANENTLY }] request with redirect { follow: 0 } and catch an error`,
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
      } [${ HTTP_STATUS_MOVED_PERMANENTLY }] request with redirect { mode: error } and catch an error`,
      async () => {
        const url = new URL('/gimme/redirect', baseURL);

        await assert.rejects(rekwest(url, { redirect: 'error' }), (err) => {
          assert.equal(err.message, 'Unexpected redirect, redirect mode is set to \'error\'');
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
        assert.equal(res.cookies.get('crack'), 'duck');
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, false);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_MOVED_PERMANENTLY);
      },
    );

    it(
      `should make ${
        HTTP2_METHOD_GET
      } [${ HTTP_STATUS_MOVED_PERMANENTLY }] request with redirect { mode: follow } and retain the cookies`,
      async () => {
        const url = new URL('/gimme/redirect', baseURL);
        const res = await rekwest(url);

        assert.equal(res.body.got, 'json');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies.get('crack'), 'duck');
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, true);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(
      `should make ${
        HTTP2_METHOD_POST
      } [${ HTTP_STATUS_FOUND }] request with redirect { body: stream } and catch an error`,
      async () => {
        const url = new URL('/gimme/redirect', baseURL);

        await assert.rejects(rekwest(url, {
          body: Readable.from('zqiygyxz'),
          method: HTTP2_METHOD_POST,
        }), (err) => {
          assert.equal(err.message, 'Unable to follow redirect with body as readable stream');
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

        assert.equal(res.body.got, 'json');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies.get('crack'), 'duck');
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, true);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_UNAUTHORIZED }] request and catch an error`, async () => {
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
    });

    it(`should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_NOT_FOUND }] request and catch an error`, async () => {
      const url = new URL('/gimme/puff', baseURL);

      await assert.rejects(rekwest(url), (res) => {
        assert.equal(res.body.length, 0);
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies.get('crack'), 'duck');
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
      'gzip',
      'identity',
    ].forEach((item) => {
      it(
        `should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with "${ item }" compressed body stream`,
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

      assert.equal(res.body.toString(), (await async function () {
        const coil = [];

        for await (const it of payload) {
          coil.push(it);
        }

        return coil.join('');
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

      assert.equal(res.body.toString(), (await payload.text()));
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

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as a File`, async () => {
      const payload = new File(['bits']);
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: payload,
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), (await payload.text()));
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
      const payload = new FormData();

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
          yield 'iterator';
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

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request with body as a Uint8Array`, async () => {
      const payload = new Uint8Array([
        8,
        16,
        32,
        64,
        128,
        255,
      ]);
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: payload,
        method: HTTP2_METHOD_POST,
      });

      assert.equal(res.body.toString(), new TextDecoder().decode(payload));
      assert.equal(res.bodyUsed, true);
      assert.equal(res.httpVersion, httpVersion);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
    });

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
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and read response via "arrayBuffer" method`,
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
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and read response via "blob" method`,
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
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and read response via "buffer" method`,
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
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and read response via "json" method`,
      async () => {
        const url = new URL('/gimme/json', baseURL);
        const res = await rekwest(url, options);

        assert.equal((await res.json()).got, 'json');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies, undefined);
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and read response via "text" method`,
      async () => {
        const url = new URL('/gimme/text', baseURL);
        const res = await rekwest(url, options);

        assert.equal(await res.text(), 'got text');
        assert.equal(res.bodyUsed, true);
        assert.equal(res.cookies, undefined);
        assert.equal(res.httpVersion, httpVersion);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, HTTP_STATUS_OK);
      },
    );

    it(
      `should make ${
        HTTP2_METHOD_GET
      } [${ HTTP_STATUS_OK }] request and catch an error in attempt to re-read the response`,
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
      `should make ${ HTTP2_METHOD_GET } [${ HTTP_STATUS_OK }] request and catch an error after abort signal`,
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
