import { constants } from 'node:http2';
import { Transform } from 'node:stream';
import {
  Cookies,
  decode,
  encode,
  mediatypes,
} from '../../src/index.js';

const {
  HTTP2_HEADER_CONTENT_ENCODING,
  HTTP2_HEADER_CONTENT_TYPE,
  HTTP2_HEADER_COOKIE,
  HTTP2_HEADER_DATE,
  HTTP2_HEADER_LOCATION,
  HTTP2_HEADER_RETRY_AFTER,
  HTTP2_HEADER_SET_COOKIE,
  HTTP2_METHOD_GET,
  HTTP2_METHOD_POST,
  HTTP2_METHOD_PUT,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_MOVED_PERMANENTLY,
  HTTP_STATUS_NO_CONTENT,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
  HTTP_STATUS_PERMANENT_REDIRECT,
  HTTP_STATUS_SEE_OTHER,
  HTTP_STATUS_TOO_MANY_REQUESTS,
  HTTP_STATUS_UNAUTHORIZED,
} = constants;

const {
  APPLICATION_JSON,
  TEXT_PLAIN,
} = mediatypes;

const attsCounter = new Map();
const utcOffset = (
  seconds,
  since = Date.now(),
) => new Date(new Date(since).getTime() + seconds * 1e3).toUTCString();

export default (baseURL) => (req, res) => {
  const { href, pathname, searchParams } = new URL(req.url, baseURL);
  const retryAfter = searchParams.getAll(HTTP2_HEADER_RETRY_AFTER).length > 1
                     ? searchParams.getAll(HTTP2_HEADER_RETRY_AFTER)
                     : searchParams.get(HTTP2_HEADER_RETRY_AFTER);

  if (searchParams.has('attempts')) {
    if (attsCounter.has(href)) {
      attsCounter.set(href, attsCounter.get(href) - 1);
    } else {
      attsCounter.set(href, +searchParams.get('attempts'));
    }
  }

  res.addTrailers({
    [HTTP2_HEADER_DATE]: new Date(),
  });
  res.statusCode = HTTP_STATUS_NOT_FOUND;
  if (pathname.match(String.raw`^/gimme/cookies$`) && req.method === HTTP2_METHOD_GET) {
    const cookies = new Cookies(req.headers[HTTP2_HEADER_COOKIE]);
    const expires = searchParams.has('expires') && searchParams.get('expires');
    const maxAge = searchParams.has('maxAge') && searchParams.get('maxAge');

    res.writeHead(HTTP_STATUS_OK, [
      [
        HTTP2_HEADER_CONTENT_TYPE,
        `${ APPLICATION_JSON }; charset=utf-8`,
      ],
      [
        HTTP2_HEADER_SET_COOKIE,
        [
          'foo=bar; HttpOnly; SameSite=Lax; Secure',
          'baz=qux; Partitioned; Path=/; SameSite=None; Secure',
          'quoted="alpha;beta;gamma"; HttpOnly; Secure',
          ...expires ? [`ttl=yank; Expires=${ expires }`] : [],
          ...maxAge ? [`ttl=yank; Max-Age=${ maxAge }`] : [],
        ],
      ],
    ]);
    res.write(JSON.stringify({
      message: 'json-bourne',
      reqCookies: Object.fromEntries(cookies),
    }));
    res.end();
  } else if (pathname.match(String.raw`^/gimme/encode$`) && req.method === HTTP2_METHOD_GET) {
    res.writeHead(HTTP_STATUS_OK, { [HTTP2_HEADER_CONTENT_TYPE]: `${ TEXT_PLAIN }; charset=utf-16be` });
    res.write(Buffer.from('\ufeff🙈🙉🙊', 'utf-16le').swap16());
    res.end();
  } else if (pathname.match(String.raw`^/gimme/json$`) && req.method === HTTP2_METHOD_GET) {
    res.writeHead(HTTP_STATUS_OK, { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_JSON });
    res.write(JSON.stringify({
      message: 'json-bourne',
    }));
    res.end();
  } else if (pathname.match(String.raw`^/gimme/kaboom$`) && req.method === HTTP2_METHOD_GET) {
    res.writeHead(HTTP_STATUS_INTERNAL_SERVER_ERROR, { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_JSON });
    res.write(JSON.stringify({
      message: 'kaboom',
    }));
    res.end();
  } else if (pathname.match(String.raw`^/gimme/nothing$`) && req.method === HTTP2_METHOD_GET) {
    res.statusCode = HTTP_STATUS_NO_CONTENT;
    res.end();
  } else if (pathname.match(String.raw`^/gimme/redirect$`) && req.method === HTTP2_METHOD_GET) {
    const loc = searchParams.has('location') ? searchParams.get('location') : '/gimme/json';
    const statusCode = searchParams.has('statusCode') ? +searchParams.get('statusCode') : HTTP_STATUS_MOVED_PERMANENTLY;

    res.writeHead(statusCode, {
      [HTTP2_HEADER_LOCATION]: loc,
      ...retryAfter ? !Array.isArray(retryAfter) ? {
        [HTTP2_HEADER_RETRY_AFTER]: Number.parseInt(retryAfter, 10),
      } : {
        [HTTP2_HEADER_RETRY_AFTER]: utcOffset(...retryAfter),
      } : {},
      [HTTP2_HEADER_SET_COOKIE]: 'crack=duck; Partitioned; SameSite=Lax; Secure',
    });
    res.end();
  } else if (pathname.match(String.raw`^/gimme/reset$`) && req.method === HTTP2_METHOD_GET) {
    const retry = attsCounter.get(href);

    if (!retry) {
      res.writeHead(HTTP_STATUS_OK, { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_JSON });
      res.write(JSON.stringify({
        message: 'json-bourne',
      }));
      attsCounter.delete(href);
    }

    if (retry) {
      res.destroy(new Error('☠️'));
    } else {
      res.end();
    }
  } else if (pathname.match(String.raw`^/gimme/retry$`) && req.method === HTTP2_METHOD_GET) {
    const retry = attsCounter.get(href);

    res.writeHead(retry ? HTTP_STATUS_TOO_MANY_REQUESTS : HTTP_STATUS_OK, {
      ...!retry && { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_JSON },
      ...retryAfter ? !Array.isArray(retryAfter) ? {
        [HTTP2_HEADER_RETRY_AFTER]: Number.parseInt(retryAfter, 10),
      } : {
        [HTTP2_HEADER_RETRY_AFTER]: utcOffset(...retryAfter),
      } : {},
    });
    if (!retry) {
      res.write(JSON.stringify({
        message: 'json-bourne',
      }));
      attsCounter.delete(href);
    }

    res.end();
  } else if (pathname.match(String.raw`^/gimme/redirect$`) && req.method === HTTP2_METHOD_POST) {
    res.writeHead(HTTP_STATUS_SEE_OTHER, {
      [HTTP2_HEADER_LOCATION]: '/gimme/json',
    });
    res.end();
  } else if (pathname.match(String.raw`^/gimme/redirect$`) && req.method === HTTP2_METHOD_PUT) {
    res.writeHead(HTTP_STATUS_PERMANENT_REDIRECT, {
      [HTTP2_HEADER_LOCATION]: '/gimme/repulse',
    });
    res.end();
  } else if (pathname.match(String.raw`^/gimme/refusal$`) && req.method === HTTP2_METHOD_GET) {
    res.writeHead(HTTP_STATUS_UNAUTHORIZED, { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_JSON });
    res.write(JSON.stringify({
      message: 'unauthorized',
    }));
    res.end();
  } else if (pathname.match(String.raw`^/gimme/repulse$`) && [
    HTTP2_METHOD_POST,
    HTTP2_METHOD_PUT,
  ].includes(req.method)) {
    res.statusCode = HTTP_STATUS_OK;
    req.pipe(res);
  } else if (pathname.match(String.raw`^/gimme/squash$`) && req.method === HTTP2_METHOD_POST) {
    const encodings = req.headers[HTTP2_HEADER_CONTENT_ENCODING];

    res.writeHead(
      HTTP_STATUS_OK,
      Object.fromEntries(Object.entries(req.headers).filter(([key]) => !key.startsWith(':'))),
    );

    encode(decode(req, encodings)
      .pipe(new Transform({
        construct(cb) {
          this.data = [];
          cb();
        },
        flush(cb) {
          try {
            this.push(Buffer.concat(this.data).reverse());
          } catch (err) {
            cb(err);
          } finally {
            cb();
          }
        },
        transform(chunk, encoding, cb) {
          this.data.push(chunk);
          cb();
        },
      })), encodings).pipe(res);
  } else if (pathname.match(String.raw`^/gimme/text$`) && req.method === HTTP2_METHOD_GET) {
    res.writeHead(HTTP_STATUS_OK, { [HTTP2_HEADER_CONTENT_TYPE]: TEXT_PLAIN });
    res.write('message');
    res.end();
  } else {
    res.end();
  }
};
