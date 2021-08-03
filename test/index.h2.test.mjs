import { strict as assert } from 'assert';
import { Blob } from 'buffer';
import { once } from 'events';
import http2 from 'http2';
import { Readable } from 'stream';
import { types } from 'util';
import rekwest, {
  Cookies,
  premix,
} from '../src/index.mjs';

const {
        HTTP2_HEADER_STATUS,
      } = http2.constants;

const baseURL = new URL('http://localhost:4433');

describe('rekwest { h2: true } mode', () => {

  before(() => rekwest.defaults.h2 = true);

  after(() => rekwest.defaults.h2 = false);

  describe('with { digest: true } & { parse: true } (defaults)', () => {

    after(() => Cookies.jar.clear());

    it('should make GET [200] request and get json', async () => {
      const url = new URL('/gimme/json', baseURL);
      const res = await rekwest(url);

      assert.equal(res.body.gotta, 'json');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, 200);
    });

    it('should make GET [200] request and get plain text', async () => {
      const url = new URL('/gimme/text', baseURL);
      const res = await rekwest(url);

      assert.equal(res.body, 'gotta text');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, 200);
    });

    it('should make GET [200] request and get encoded text', async () => {
      const url = new URL('/gimme/encode', baseURL);
      const res = await rekwest(url);

      assert.equal(res.body, '杯瑴愠瑥硴');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, 200);
    });

    it('should make GET [200] request with cookies and get more cookies', async () => {
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
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, 200);
    });

    it('should make GET [204] request with new and preserved cookies', async () => {
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
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, 204);
    });

    it('should make GET [204] request without cookies', async () => {
      const url = new URL('/gimme/nothing', baseURL);
      const res = await rekwest(url, { cookies: false });

      assert.equal(res.body.length, 0);
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, 204);
    });

    it('should make GET [301] request with redirect { mode: false } and get new cookies', async () => {
      const url = new URL('/gimme/redirect', baseURL);
      const res = await rekwest(url, { redirect: false });

      assert.equal(res.body.length, 0);
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies?.crack, 'duck');
      assert.equal(res.ok, false);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, 301);
    });

    it('should make GET [301] request with redirect { mode: follow } and retain cookies', async () => {
      const url = new URL('/gimme/redirect', baseURL);
      const res = await rekwest(url);

      assert.equal(res.body.gotta, 'json');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies?.crack, 'duck');
      assert.equal(res.ok, true);
      assert.equal(res.redirected, true);
      assert.equal(res.statusCode, 200);
    });

    it('should make GET [301] request with redirect { mode: error } and catch error', async () => {
      const url = new URL('/gimme/redirect', baseURL);
      const res = await rekwest(url, { redirect: 'error' }).catch((err) => err);

      assert.match(res.message, /Unexpected redirect, redirect mode is set to error/);
      assert.equal(res.name, 'RequestError');
    });

    it('should make GET [301] request with redirect { follow: 0 } and catch error', async () => {
      const url = new URL('/gimme/redirect', baseURL);
      const res = await rekwest(url, { follow: 0 }).catch((err) => err);

      assert.match(res.message, /Maximum redirect reached at:/);
      assert.equal(res.name, 'RequestError');
    });

    it('should make POST [302] request with redirect { body: stream } and catch error', async () => {
      const url = new URL('/gimme/redirect', baseURL);
      const res = await rekwest(url, {
        body: Readable.from(Array.from('zqiygyxz')),
        method: 'POST',
      }).catch((err) => err);

      assert.match(res.message, /Unable to follow redirect with body as readable stream/);
      assert.equal(res.name, 'RequestError');
    });

    it('should make PUT [303] request with redirect { body: json }', async () => {
      const url = new URL('/gimme/redirect', baseURL);
      const res = await rekwest(url, {
        body: { eldritch: 'symbols' },
        method: 'PUT',
      });

      assert.equal(res.body.gotta, 'json');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies?.crack, 'duck');
      assert.equal(res.ok, true);
      assert.equal(res.redirected, true);
      assert.equal(res.statusCode, 200);
    });

    it('should make GET [401] request and catch error', async () => {
      const url = new URL('/gimme/refusal', baseURL);
      const res = await rekwest(url).catch((res) => res);

      assert.equal(res.body.message, 'unauthorized');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies?.crack, 'duck');
      assert.equal(res.ok, false);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, 401);
    });

    it('should make GET [404] request and catch error', async () => {
      const url = new URL('/gimme/puff', baseURL);
      const res = await rekwest(url).catch((res) => res);

      assert.equal(res.body.length, 0);
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies?.crack, 'duck');
      assert.equal(res.ok, false);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, 404);
    });

    [
      'br',
      'deflate',
      'gzip',
      'identity',
    ].forEach((item) => {
      it(`should make POST [200] request with "${ item }" compressed body`, async () => {
        const url = new URL('/gimme/squash', baseURL);
        const res = await rekwest(url, {
          body: Buffer.from('zqiygyxz'),
          headers: {
            'accept-encoding': item,
            'content-encoding': item,
            'vary': 'accept-encoding',
          },
          method: 'POST',
        });

        assert.equal(res.body, 'zqiygyxz'.split('').reverse().join(''));
        assert.equal(res.bodyUsed, true);
        assert.equal(res.ok, true);
        assert.equal(res.redirected, false);
        assert.equal(res.statusCode, 200);
      });
    });

    it('should make POST [200] request with blob', async () => {
      const url = new URL('/gimme/repulse', baseURL);
      const res = await rekwest(url, {
        body: new Blob(['blob']),
        method: 'POST',
      });

      assert.equal(res.body.toString(), 'blob');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, 200);
    });

  });

  describe('with { digest: false } & { parse: false }', () => {

    const opts = { digest: false, parse: false };

    it('should make GET [200] request and resolve to arrayBuffer', async () => {
      const url = new URL('/gimme/text', baseURL);
      const res = await rekwest(url, opts);

      assert.ok(types.isArrayBuffer(await res.arrayBuffer()));
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, 200);
    });

    it('should make GET [200] request and resolve to blob', async () => {
      const url = new URL('/gimme/text', baseURL);
      const res = await rekwest(url, opts);

      assert.ok((await res.blob())?.constructor.name === 'Blob');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, 200);
    });

    it('should make GET [200] request and resolve to buffer', async () => {
      const url = new URL('/gimme/text', baseURL);
      const res = await rekwest(url, opts);

      assert.ok(Buffer.isBuffer(await res.body()));
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, 200);
    });

    it('should make GET [200] request and resolve to json', async () => {
      const url = new URL('/gimme/json', baseURL);
      const res = await rekwest(url, opts);

      assert.equal((await res.json()).gotta, 'json');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, 200);
    });

    it('should make GET [200] request and resolve to text', async () => {
      const url = new URL('/gimme/text', baseURL);
      const res = await rekwest(url, opts);

      assert.equal(await res.text(), 'gotta text');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.ok, true);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, 200);
    });

  });

  describe('with { thenable: true }', () => {

    it('should make GET [500] request and slip the error', async () => {
      const url = new URL('/gimme/kaboom', baseURL);
      const res = await rekwest(url, { thenable: true });

      assert.equal(res.body.message, 'kaboom');
      assert.equal(res.bodyUsed, true);
      assert.equal(res.cookies, undefined);
      assert.equal(res.ok, false);
      assert.equal(res.redirected, false);
      assert.equal(res.statusCode, 500);
    });

  });

  describe('stream withal', () => {

    it('should pipe throughout POST [200] request', async () => {
      const url = new URL('/gimme/squash', baseURL);
      const req = Readable.from('zqiygyxz').pipe(rekwest.stream(url, { method: 'POST' }));
      const [headers] = await once(req, 'response');

      Reflect.set(req, 'headers', headers);

      assert.equal(headers[HTTP2_HEADER_STATUS], 200);
      assert.equal((await premix(req).body()).toString(), 'zqiygyxz'.split('').reverse().join(''));
    });

  });

});
