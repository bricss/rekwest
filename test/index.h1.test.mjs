import { strict as assert } from 'assert';
import { once } from 'events';
import { Readable } from 'stream';
import rekwest, {
  constants,
  premix,
} from '../src/index.mjs';
import shared from './index.shared.mjs';

const {
        HTTP2_METHOD_POST,
        HTTP_STATUS_OK,
      } = constants;

const baseURL = new URL('http://localhost:3000');
const httpVersion = '1.1';

describe('rekwest', () => {

  shared({ baseURL, httpVersion });

  describe('stream withal', () => {

    it(`should pipe throughout ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request`, async () => {
      const url = new URL('/gimme/squash', baseURL);
      const req = Readable.from('zqiygyxz').pipe(rekwest.stream(url, { method: HTTP2_METHOD_POST }));
      const [res] = await once(req, 'response');

      assert.equal(res.statusCode, HTTP_STATUS_OK);
      assert.equal((await premix(res).body()).toString(), 'zqiygyxz'.split('').reverse().join(''));
    });

  });

});
