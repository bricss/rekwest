import { constants } from 'http2';
import {
  PassThrough,
  Transform,
} from 'stream';
import zlib from 'zlib';
import {
  APPLICATION_JSON,
  TEXT_PLAIN,
} from '../../src/mediatypes.mjs';

const {
  HTTP2_HEADER_CONTENT_ENCODING,
  HTTP2_HEADER_CONTENT_TYPE,
  HTTP2_HEADER_DATE,
  HTTP2_HEADER_LOCATION,
  HTTP2_HEADER_RETRY_AFTER,
  HTTP2_HEADER_SET_COOKIE,
  HTTP2_METHOD_GET,
  HTTP2_METHOD_POST,
  HTTP2_METHOD_PUT,
  HTTP_STATUS_FOUND,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_MOVED_PERMANENTLY,
  HTTP_STATUS_NO_CONTENT,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
  HTTP_STATUS_SEE_OTHER,
  HTTP_STATUS_TOO_MANY_REQUESTS,
  HTTP_STATUS_UNAUTHORIZED,
} = constants;

const attempts = 'attempts';
const json = {
  message: 'json',
};
const sentinel = (date, lapse = '1') => new Date(date.getTime() + (lapse.split(':').pop() * 1e3)).toUTCString();
const stowage = new Map();

export default (baseURL) => (req, res) => {
  const { href, pathname, searchParams } = new URL(req.url, baseURL);
  const retryAfter = searchParams.get(HTTP2_HEADER_RETRY_AFTER);

  if (searchParams.has(attempts)) {
    if (stowage.has(href)) {
      stowage.set(href, stowage.get(href) - 1);
    } else {
      stowage.set(href, +searchParams.get(attempts));
    }
  }

  res.addTrailers({
    [HTTP2_HEADER_DATE]: new Date(),
  });
  res.statusCode = HTTP_STATUS_NOT_FOUND;
  if (pathname.match(String.raw`/gimme/cookies`) && req.method === HTTP2_METHOD_GET) {
    res.writeHead(HTTP_STATUS_OK, [
      [
        HTTP2_HEADER_CONTENT_TYPE,
        `${ APPLICATION_JSON }; charset=utf-8`,
      ],
      [
        HTTP2_HEADER_SET_COOKIE,
        [
          'foo=bar; HttpOnly; Secure',
          'qux=zap; Path=/',
        ],
      ],
    ]);
    res.write(JSON.stringify(json));
    res.end();
  } else if (pathname.match(String.raw`/gimme/encode`) && req.method === HTTP2_METHOD_GET) {
    res.writeHead(HTTP_STATUS_OK, { [HTTP2_HEADER_CONTENT_TYPE]: `${ TEXT_PLAIN }; charset=utf-16be` });
    res.write(new TextEncoder().encode('message'));
    res.end();
  } else if (pathname.match(String.raw`/gimme/json`) && req.method === HTTP2_METHOD_GET) {
    res.writeHead(HTTP_STATUS_OK, { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_JSON });
    res.write(JSON.stringify(json));
    res.end();
  } else if (pathname.match(String.raw`/gimme/kaboom`) && req.method === HTTP2_METHOD_GET) {
    res.writeHead(HTTP_STATUS_INTERNAL_SERVER_ERROR, { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_JSON });
    res.write(JSON.stringify({
      message: 'kaboom',
    }));
    res.end();
  } else if (pathname.match(String.raw`/gimme/nothing`) && req.method === HTTP2_METHOD_GET) {
    res.statusCode = HTTP_STATUS_NO_CONTENT;
    res.end();
  } else if (pathname.match(String.raw`/gimme/redirect`) && req.method === HTTP2_METHOD_GET) {
    res.writeHead(HTTP_STATUS_MOVED_PERMANENTLY, {
      [HTTP2_HEADER_LOCATION]: '/gimme/json',
      ...retryAfter ? Number(retryAfter) ? {
        [HTTP2_HEADER_RETRY_AFTER]: JSON.parse(retryAfter),
      } : {
        [HTTP2_HEADER_RETRY_AFTER]: sentinel(new Date(), retryAfter),
      } : {},
      [HTTP2_HEADER_SET_COOKIE]: 'crack=duck; SameParty; SameSite=Lax',
    });
    res.end();
  } else if (pathname.match(String.raw`/gimme/retry`) && req.method === HTTP2_METHOD_GET) {
    const retry = stowage.get(href);

    res.writeHead(retry ? HTTP_STATUS_TOO_MANY_REQUESTS : HTTP_STATUS_OK, {
      ...!retry && { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_JSON },
      ...retryAfter ? Number(retryAfter) ? {
        [HTTP2_HEADER_RETRY_AFTER]: JSON.parse(retryAfter),
      } : {
        [HTTP2_HEADER_RETRY_AFTER]: sentinel(new Date(), retryAfter),
      } : {},
    });
    if (!retry) {
      res.write(JSON.stringify(json));
      stowage.delete(href);
    }

    res.end();
  } else if (pathname.match(String.raw`/gimme/redirect`) && req.method === HTTP2_METHOD_POST) {
    res.writeHead(HTTP_STATUS_FOUND, {
      [HTTP2_HEADER_LOCATION]: '/gimme/void',
    });
    res.end();
  } else if (pathname.match(String.raw`/gimme/redirect`) && req.method === HTTP2_METHOD_PUT) {
    res.writeHead(HTTP_STATUS_SEE_OTHER, {
      [HTTP2_HEADER_LOCATION]: '/gimme/json',
    });
    res.end();
  } else if (pathname.match(String.raw`/gimme/refusal`) && req.method === HTTP2_METHOD_GET) {
    res.writeHead(HTTP_STATUS_UNAUTHORIZED, { [HTTP2_HEADER_CONTENT_TYPE]: APPLICATION_JSON });
    res.write(JSON.stringify({
      message: 'unauthorized',
    }));
    res.end();
  } else if (pathname.match(String.raw`/gimme/repulse`) && req.method === HTTP2_METHOD_POST) {
    res.statusCode = HTTP_STATUS_OK;
    req.pipe(res);
  } else if (pathname.match(String.raw`/gimme/squash`) && req.method === HTTP2_METHOD_POST) {
    const compressor = {
      br: zlib.createBrotliCompress,
      deflate: zlib.createDeflate,
      gzip: zlib.createGzip,
    }[req.headers[HTTP2_HEADER_CONTENT_ENCODING]] ?? PassThrough;
    const decompressor = {
      br: zlib.createBrotliDecompress,
      deflate: zlib.createInflate,
      gzip: zlib.createUnzip,
    }[req.headers[HTTP2_HEADER_CONTENT_ENCODING]] ?? PassThrough;

    res.writeHead(
      HTTP_STATUS_OK,
      Object.fromEntries(Object.entries(req.headers).filter(([key]) => !key.startsWith(':'))),
    );
    req.pipe(decompressor()).setEncoding('utf-8')
       .pipe(new Transform({
         construct(cb) {
           this.data = '';
           cb();
         },
         decodeStrings: false,
         flush(cb) {
           try {
             this.push(this.data.split('').reverse().join(''));
           } catch (ex) {
             cb(ex);
           } finally {
             cb();
           }
         },
         transform(chunk, encoding, cb) {
           this.data += chunk;
           cb();
         },
       })).pipe(compressor()).pipe(res);
  } else if (pathname.match(String.raw`/gimme/text`) && req.method === HTTP2_METHOD_GET) {
    res.writeHead(HTTP_STATUS_OK, { [HTTP2_HEADER_CONTENT_TYPE]: TEXT_PLAIN });
    res.write('message');
    res.end();
  } else {
    res.end();
  }
};
