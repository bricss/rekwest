import { strict as assert } from 'node:assert';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import rekwest, {
  ackn,
  constants,
  mixin,
} from '../src/index.mjs';
import shared from './index.shared.mjs';

const {
  HTTP2_METHOD_POST,
  HTTP_STATUS_OK,
} = constants;

const baseURL = globalThis.baseH2URL;
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
      const url = new URL('/gimme/squash', baseURL);
      const options = await ackn({ rejectUnauthorized, url });
      const req = Readable.from('zqiygyxz').pipe(rekwest.stream(url, { ...options, method: HTTP2_METHOD_POST }));
      const [headers] = await once(req, 'response');

      assert.equal(req.headers, headers);
      assert.equal(req.statusCode, HTTP_STATUS_OK);
      assert.equal((await mixin(req).body()).toString(), 'zqiygyxz'.split('').reverse().join(''));
    });

  });

});
