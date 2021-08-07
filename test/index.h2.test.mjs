import { strict as assert } from 'assert';
import { once } from 'events';
import { Readable } from 'stream';
import rekwest, {
  constants,
  premix,
} from '../src/index.mjs';
import shared from './index.shared.mjs';

const {
        HTTP2_HEADER_STATUS,
        HTTP2_METHOD_POST,
        HTTP_STATUS_OK,
      } = constants;

const baseURL = new URL('https://localhost:3433');
const httpVersion = '2.0';

describe('rekwest { h2: true } mode', () => {

  before(() => {
    rekwest.defaults = {
      rejectUnauthorized: false,
    };
  });

  after(() => rekwest.defaults = Object.create(null));

  shared({ baseURL, httpVersion });

  describe('stream withal', () => {

    it(`should pipe throughout ${ HTTP2_METHOD_POST } [${ HTTP_STATUS_OK }] request`, async () => {
      const url = new URL('/gimme/squash', baseURL);
      const req = Readable.from('zqiygyxz').pipe(rekwest.stream(url, { h2: true, method: HTTP2_METHOD_POST }));
      const [headers] = await once(req, 'response');

      Reflect.set(req, 'headers', headers);

      assert.equal(headers[HTTP2_HEADER_STATUS], HTTP_STATUS_OK);
      assert.equal((await premix(req).body()).toString(), 'zqiygyxz'.split('').reverse().join(''));
    });

  });

});
