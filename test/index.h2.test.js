import { strict as assert } from 'node:assert';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import rekwest, { constants } from '../src/index.js';
import shared from './index.shared.js';

const {
  HTTP2_METHOD_POST,
  HTTP_STATUS_OK,
} = constants;

const baseURL = globalThis.https2BaseURL;
const httpVersion = '2.0';
const rejectUnauthorized = false;

describe('rekwest { h2 } mode', () => {

  before(() => {
    rekwest.defaults = {
      rejectUnauthorized,
    };
  });

  after(() => Reflect.deleteProperty(rekwest.defaults, 'rejectUnauthorized'));

  shared({ baseURL, httpVersion });

  describe('withal stream', () => {

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request and must pipe throughout it`, async () => {
      const payload = 'zqiygyxz';
      const url = new URL('/gimme/squash', baseURL);
      const req = Readable.from(payload).pipe(rekwest.stream(url, { h2: true, method: HTTP2_METHOD_POST }));

      await once(req, 'response');

      assert.ok(req.ok);
      assert.equal(req.statusCode, HTTP_STATUS_OK);
      assert.equal(
        new TextDecoder('utf-8', { fatal: true }).decode(await buffer(req)).toString(),
        payload.split('').reverse().join(''),
      );
    });

  });

});
