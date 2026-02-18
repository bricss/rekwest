The robust request library that humanity deserves 🌐
---
This package provides highly likely functional and **easy-to-use** abstraction atop of
native [http(s).request](https://nodejs.org/api/https.html#httpsrequesturl-options-callback)
and [http2.request](https://nodejs.org/api/http2.html#clienthttp2sessionrequestheaders-options).

## Abstract

* Fetch-alike 🥏
* Cool-beans 🫐 config options (with defaults) 📋
* Automatic HTTP/2 support (ALPN negotiation) 💼
* Automatic or opt-in body parse (with non-UTF-8 charset decoding) 🉑
* Automatic and simplistic `Cookies` treatment (with **TTL** support) 🍪
* Automatic body decoding (and opt-in request body encoding) 🗜️
* Better error management 🚥
* Built-in streamable `FormData` interface 🔌
* Support redirects & retries with fine-grained tune-ups 🪛
* Support plenty request body types (include blobs & streams) 📦
* Support both CJS and ESM module systems 🧩
* Fully promise-able ⏳ and pipe-able 🌀
* Zero dependencies 🗽

## Prerequisites

* Node.js `>= 20.0.0`

## Installation

```bash
npm install rekwest --save
```

### Usage

```javascript
import rekwest, { constants } from 'rekwest';

const {
  HTTP2_HEADER_AUTHORIZATION,
  HTTP2_HEADER_CONTENT_ENCODING,
  HTTP2_METHOD_POST,
  HTTP_STATUS_OK,
} = constants;

const url = 'https://somewhe.re/somewhat/endpoint';

const res = await rekwest(url, {
  body: { celestial: 'payload' },
  headers: {
    [HTTP2_HEADER_AUTHORIZATION]: 'Bearer [token]',
    [HTTP2_HEADER_CONTENT_ENCODING]: 'br',  // Enables: body encoding
    /** [HTTP2_HEADER_CONTENT_TYPE] is undue for
     * Array/Blob/File/FormData/Object/URLSearchParams body types
     * and will be set automatically, with an option to override it here
     */
  },
  method: HTTP2_METHOD_POST,
});

console.assert(res.statusCode === HTTP_STATUS_OK);
console.info(res.headers);
console.log(res.body);
```

---

```javascript
import { Readable } from 'node:stream';
import rekwest, {
  constants,
  Blob,
  File,
  FormData,
} from 'rekwest';

const {
  HTTP2_HEADER_AUTHORIZATION,
  HTTP2_HEADER_CONTENT_ENCODING,
  HTTP2_METHOD_POST,
  HTTP_STATUS_OK,
} = constants;

const blob = new Blob(['bits']);
const file = new File(['bits'], 'file.xyz');
const readable = Readable.from('bits');

const fd = new FormData({
  aux: Date.now(),  // Either [[key, value]] or kv sequenceable
});

fd.append('celestial', 'payload');
fd.append('blob', blob, 'blob.xyz');
fd.append('file', file);
fd.append('readable', readable, 'readable.xyz');

const url = 'https://somewhe.re/somewhat/endpoint';

const res = await rekwest(url, {
  body: fd,
  headers: {
    [HTTP2_HEADER_AUTHORIZATION]: 'Bearer [token]',
    [HTTP2_HEADER_CONTENT_ENCODING]: 'zstd',  // Enables: body encoding
  },
  method: HTTP2_METHOD_POST,
});

console.assert(res.statusCode === HTTP_STATUS_OK);
console.info(res.headers);
console.log(res.body);
```

### API

#### `rekwest(url[, options])`

* `url` **{string | URL}** The URL to send the request to
* `options` **{Object}**
  Extends [http(s).RequestOptions](https://nodejs.org/api/https.html#httpsrequesturl-options-callback) along with
  extra [http2.ClientSessionOptions](https://nodejs.org/api/http2.html#http2connectauthority-options-listener)
  & [http2.ClientSessionRequestOptions](https://nodejs.org/api/http2.html#clienthttp2sessionrequestheaders-options)
  and [tls.ConnectionOptions](https://nodejs.org/api/tls.html#tlsconnectoptions-callback)
  for HTTP/2 attunes
  * `allowDowngrade` **{boolean}** `Default: false` Controls whether `https:` redirects to `http:` are allowed
  * `baseURL` **{string | URL}** The base URL to use in cases where `url` is a relative URL
  * `body` **{string | Array | ArrayBuffer | ArrayBufferView | AsyncIterator | Blob | Buffer | DataView | File |
    FormData | Iterator | Object | Readable | ReadableStream | SharedArrayBuffer | URLSearchParams}** The body to send
    with the request
  * `bufferBody` **{boolean}** `Default: false` Toggles the buffering of the streamable request bodies for redirects and
    retries
  * `cookies` **{boolean | string | string[] | [k, v][] | Cookies | Object | URLSearchParams}** `Default: true` The
    cookies to add to the request. Manually set `cookie` header to override.
  * `cookiesTTL` **{boolean}** `Default: false` Controls enablement of TTL for the cookies cache
  * `credentials` **{include | omit | same-origin}** `Default: same-origin` Controls credentials in case of cross-origin
    redirects
  * `decodersOptions` **{Object}** Configures decoders options, e.g.: `brotli`, `zlib`, `zstd`
  * `digest` **{boolean}** `Default: true` Controls whether to read the response stream or add a mixin
  * `encodersOptions` **{Object}** Configures encoders options, e.g.: `brotli`, `zlib`, `zstd`
  * `follow` **{number}** `Default: 20` The number of redirects to follow
  * `h2` **{boolean}** `Default: false` Forces the use of HTTP/2 protocol
  * `headers` **{Object}** The headers to add to the request
  * `params` **{Object}** The search params to add to the `url`
  * `parse` **{boolean}** `Default: true` Controls whether to parse response body or return a buffer
  * `redirect` **{error | follow | manual}** `Default: follow` Controls the redirect flows
  * `retry` **{Object}** Represents the retry options
    * `attempts` **{number}** `Default: 0` The number of retry attempts
    * `backoffStrategy` **{string}** `Default: interval * Math.log(Math.random() * (Math.E * Math.E - Math.E) + Math.E)`
      The backoff strategy uses a log-uniform algorithm. To fix the interval, set the value to `interval * 1`.
    * `errorCodes` **{string[]}**
      `Default: ['ECONNREFUSED', 'ECONNRESET', 'EHOSTDOWN', 'EHOSTUNREACH', 'ENETDOWN', 'ENETUNREACH', 'ENOTFOUND', 'ERR_HTTP2_STREAM_ERROR']`
      The list of error codes to retry on
    * `interval` **{number}** `Default: 1e3` The initial retry interval
    * `maxRetryAfter` **{number}** `Default: 3e5` The maximum `retry-after` limit in milliseconds
    * `retryAfter` **{boolean}** `Default: true` Controls `retry-after` header receptiveness
    * `statusCodes` **{number[]}** `Default: [429, 500, 502, 503, 504]` The list of status codes to retry on
  * `stripTrailingSlash` **{boolean}** `Default: false` Controls whether to strip trailing slash at the end of the URL
  * `thenable` **{boolean}** `Default: false` Controls the promise resolutions
  * `timeout` **{number}** `Default: 3e5` The number of milliseconds a request can take before termination
  * `trimTrailingSlashes` **{boolean}** `Default: false` Controls whether to trim trailing slashes within the URL
* **Returns:** Promise that resolves to
  extended [http.IncomingMessage](https://nodejs.org/api/http.html#class-httpincomingmessage)
  or [http2.ClientHttp2Stream](https://nodejs.org/api/http2.html#class-clienthttp2stream) which is respectively
  readable and duplex streams
  * if `digest: true` & `parse: true`
    * `body` **{string | Array | Buffer | Object}** The body based on its content type
  * if `digest: false`
    * `arrayBuffer` **{AsyncFunction}** Reads the response and returns **ArrayBuffer**
    * `blob` **{AsyncFunction}** Reads the response and returns **Blob**
    * `body` **{AsyncFunction}** Reads the response and returns **Buffer** if `parse: false`
    * `bytes` **{AsyncFunction}** Reads the response and returns **Uint8Array**
    * `json` **{AsyncFunction}** Reads the response and returns **Object**
    * `text` **{AsyncFunction}** Reads the response and returns **String**
  * `bodyUsed` **{boolean}** Indicates whether the response was read or not
  * `cookies` **{undefined | Cookies}** The cookies sent and received with the response
  * `headers` **{Object}** The headers received with the response
  * `httpVersion` **{string}** Indicates a protocol version negotiated with the server
  * `ok` **{boolean}** Indicates if the response was successful (statusCode: **200-299**)
  * `redirected` **{boolean}** Indicates if the response is the result of a redirect
  * `statusCode` **{number}** Indicates the status code of the response
  * `trailers` **{undefined | Object}** The trailer headers received with the response

---

#### `rekwest.defaults`

The object to fulfill with default [options](#rekwesturl-options).

---

#### `rekwest.extend(options)`

The method to extend default [options](#rekwesturl-options) per instance.

```javascript
import rekwest, { constants } from 'rekwest';

const {
  HTTP_STATUS_OK,
} = constants;

const rk = rekwest.extend({
  baseURL: 'https://somewhe.re',
});

const params = {
  id: '[uid]',
  signature: '[code]',
  variant: 'A',
};
const signal = AbortSignal.timeout(3e4);
const url = '/somewhat/endpoint';

const res = await rk(url, {
  params,
  signal,
});

console.assert(res.statusCode === HTTP_STATUS_OK);
console.info(res.headers);
console.log(res.body);
```

---

#### `rekwest.stream(url[, options])`

The method with limited functionality to use with streams and/or pipes.

* No automata (redirects & retries)
* Pass `h2: true` in options to use HTTP/2 protocol
  * Use `ackn({ url: URL })` method in advance to check the available protocols

```javascript
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import rekwest, {
  ackn,
  constants,
} from 'rekwest';

const {
  HTTP2_METHOD_POST,
} = constants;

const url = new URL('https://somewhe.re/somewhat/endpoint');
const options = await ackn({ url });

await pipeline(
  fs.createReadStream('/path/to/read/inlet.xyz'),
  rekwest.stream(url, { ...options, method: HTTP2_METHOD_POST }),
  fs.createWriteStream('/path/to/write/outlet.xyz'),
);
```

---

For more details, please check tests (coverage: **>97%**) in the repository.
