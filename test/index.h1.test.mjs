import { strict as assert } from 'node:assert';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import rekwest, {
  constants,
  mixin,
} from '../src/index.mjs';
import shared from './index.shared.mjs';

const {
  HTTP2_METHOD_POST,
  HTTP_STATUS_OK,
} = constants;

const baseURL = globalThis.baseH1URL;
const httpVersion = '1.1';

describe('rekwest', () => {

  shared({ baseURL, httpVersion });

  describe('and stream withal', () => {

    it(`should make ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request and must pipe throughout it`, async () => {
      const url = new URL('/gimme/squash', baseURL);
      const req = Readable.from('zqiygyxz').pipe(rekwest.stream(url, { method: HTTP2_METHOD_POST }));
      const [res] = await once(req, 'response');

      assert.ok(res.ok);
      assert.equal(res.statusCode, HTTP_STATUS_OK);
      assert.equal((await mixin(res).body()).toString(), 'zqiygyxz'.split('').reverse().join(''));
    });

  });

});
