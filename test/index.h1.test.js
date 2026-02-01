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

const baseURL = globalThis.http1BaseURL;
const httpVersion = '1.1';
const rejectUnauthorized = false;

describe('rekwest', () => {

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
      const req = Readable.from(payload).pipe(rekwest.stream(url, { method: HTTP2_METHOD_POST }));
      const [res] = await once(req, 'response');

      assert.ok(res.ok);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
      assert.equal(
        new TextDecoder('utf-8', { fatal: true }).decode(await buffer(res)).toString(),
        payload.split('').reverse().join(''),
      );
    });

  });

});
