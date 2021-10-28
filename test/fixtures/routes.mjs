import { constants } from 'http2';
import {
  PassThrough,
  Transform,
} from 'stream';
import zlib from 'zlib';

const {
  HTTP2_HEADER_CONTENT_ENCODING,
  HTTP2_HEADER_CONTENT_TYPE,
  HTTP2_HEADER_SET_COOKIE,
  HTTP2_HEADER_LOCATION,
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
  HTTP_STATUS_UNAUTHORIZED,
} = constants;

export default (baseURL) => (req, res) => {
  const { pathname } = new URL(req.url, baseURL);

  res.statusCode = HTTP_STATUS_NOT_FOUND;
  if (pathname.match(String.raw`/gimme/cookies`) && req.method === HTTP2_METHOD_GET) {
    res.writeHead(HTTP_STATUS_OK, [
      [
        HTTP2_HEADER_CONTENT_TYPE,
        'application/json; charset=utf-8',
      ],
      [
        HTTP2_HEADER_SET_COOKIE,
        [
          'foo=bar; HttpOnly',
          'qux=zap; Path=/',
        ],
      ],
    ]);
    res.write(JSON.stringify({
      got: 'cookies',
    }));
    res.end();
  } else if (pathname.match(String.raw`/gimme/encode`) && req.method === HTTP2_METHOD_GET) {
    const charset = 'utf-16be';

    res.writeHead(HTTP_STATUS_OK, { [HTTP2_HEADER_CONTENT_TYPE]: `text/plain; charset=${ charset }` });
    res.write(new TextEncoder(charset).encode('got text'));
    res.end();
  } else if (pathname.match(String.raw`/gimme/json`) && req.method === HTTP2_METHOD_GET) {
    res.writeHead(HTTP_STATUS_OK, { [HTTP2_HEADER_CONTENT_TYPE]: 'application/json' });
    res.write(JSON.stringify({
      got: 'json',
    }));
    res.end();
  } else if (pathname.match(String.raw`/gimme/kaboom`) && req.method === HTTP2_METHOD_GET) {
    res.writeHead(HTTP_STATUS_INTERNAL_SERVER_ERROR, { [HTTP2_HEADER_CONTENT_TYPE]: 'application/json' });
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
      [HTTP2_HEADER_SET_COOKIE]: 'crack=duck; SameSite=Lax',
    });
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
    res.writeHead(HTTP_STATUS_UNAUTHORIZED, { [HTTP2_HEADER_CONTENT_TYPE]: 'application/json' });
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

    res.writeHead(HTTP_STATUS_OK, {
      [HTTP2_HEADER_CONTENT_ENCODING]: req.headers[HTTP2_HEADER_CONTENT_ENCODING] ?? 'utf-8',
      [HTTP2_HEADER_CONTENT_TYPE]: 'text/plain',
    });
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
    res.writeHead(HTTP_STATUS_OK, { [HTTP2_HEADER_CONTENT_TYPE]: 'text/plain' });
    res.write('got text');
    res.end();
  } else {
    res.end();
  }
};
