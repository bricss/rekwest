The robust request library that humanity deserves 🌐
---
This package provides highly likely functional and **easy-to-use** abstraction atop of
native [http(s).request](https://nodejs.org/api/https.html#https_https_request_url_options_callback)
and [http2.request](https://nodejs.org/api/http2.html#http2_clienthttp2session_request_headers_options).

## Abstract

* Fetch-alike
* Cool-beans config options (with defaults)
* Automatic HTTP2 support (ALPN negotiation)
* Automatic or opt-in body parse (with non-UTF-8 charset decoding)
* Automatic and simplistic `Cookies` treatment (with built-in jar)
* Automatic decompression (with opt-in body compression)
* Built-in streamable `File` & `FormData` interfaces
* Support redirects with fine-grained tune-ups
* Support all legit request body types (include blobs & streams)
* Support both CJS and ESM module systems
* Fully promise-able and pipe-able
* Zero dependencies

## Prerequisites

* Node.js `>= 16.x`

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
  HTTP_STATUS_OK
} = constants;

const url = 'https://somewhe.re/somewhat/endpoint';

const res = await rekwest(url, {
  body: { celestial: 'payload' },
  headers: {
    [HTTP2_HEADER_AUTHORIZATION]: 'Bearer [token]',
    [HTTP2_HEADER_CONTENT_ENCODING]: 'br',  // enables: body compression
    /** [HTTP2_HEADER_CONTENT_TYPE]
     * is undue for
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
import rekwest, {
  constants,
  Blob,
  File,
  FormData
} from 'rekwest';
import { Readable } from 'stream';

const {
  HTTP2_METHOD_POST,
  HTTP_STATUS_OK
} = constants;

const blob = new Blob(['bits']);
const file = new File(['bits'], 'file.dab');
const readable = Readable.from('bits');
const fd = new FormData();

fd.append('celestial', 'payload');
fd.append('blob', blob, 'blob.dab');
fd.append('file', file);
fd.append('readable', readable, 'readable.dab');

const url = 'https://somewhe.re/somewhat/endpoint';

const res = await rekwest(url, {
  body: fd,
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
  Extends [https.RequestOptions](https://nodejs.org/api/https.html#https_https_request_url_options_callback)
  along with
  extra [http2.ClientSessionOptions](https://nodejs.org/api/http2.html#http2_http2_connect_authority_options_listener)
  & [http2.ClientSessionRequestOptions](https://nodejs.org/api/http2.html#http2_clienthttp2session_request_headers_options)
  and [tls.ConnectionOptions](https://nodejs.org/api/tls.html#tls_tls_connect_options_callback)
  for the HTTP2 attunes
  * `body` **{string | Array | AsyncIterator | Blob | Buffer | File | FromData | Iterator | Object | Readable |
    Uint8Array | URLSearchParams}** Body to send with the request
  * `cookies` **{boolean | Object}** `Default: true` Cookies to add to the request
  * `digest` **{boolean}** `Default: true` Read response stream, or simply add a mixin
  * `follow` **{number}** `Default: 20` Number of redirects to follow
  * `h2` **{boolean}** `Default: false` Forces use of the HTTP2 protocol
  * `headers` **{Object}** Headers to add to the request
  * `parse` **{boolean}** `Default: true` Parse response body, or simply return a buffer
  * `redirect` **{boolean | error | follow}** `Default: 'follow'` Controls redirect flow
  * `thenable` **{boolean}** `Default: false` Controls promise resolutions
* **Returns:** Promise that resolves to
  extended [http.IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
  or [http2.ClientHttp2Stream](https://nodejs.org/api/http2.html#http2_class_clienthttp2stream) which is respectively
  readable and duplex streams
  * if `degist: true` & `parse: true`
    * `body` **{string | Array | Buffer | Object}** Body based on its content type
  * if `degist: false`
    * `arrayBuffer` **{AsyncFunction}** Reads the response and returns **ArrayBuffer**
    * `blob` **{AsyncFunction}** Reads the response and returns **Blob**
    * `body` **{AsyncFunction}** Reads the response and returns **Buffer** if `parse: false`
    * `json` **{AsyncFunction}** Reads the response and returns **Object**
    * `text` **{AsyncFunction}** Reads the response and returns **String**
  * `bodyUsed` **{boolean}** Whether the response were read or not
  * `cookies` **{undefined | Object}** Cookies sent and received with the response
  * `headers` **{Object}** Headers received with the response
  * `httpVersion` **{string}** Indicates protocol version negotiated with the server
  * `ok` **{boolean}** Indicates if the response was successful (statusCode: **200-299**)
  * `redirected` **{boolean}** Indicates if the response is the result of a redirect
  * `statusCode` **{number}** Indicates the status code of the response

---

#### `rekwest.defaults`

Object to fill with default [options](#rekwesturl-options)

---

#### `rekwest.stream(url[, options])`

Method with limited functionality to use with streams and pipes

* No automata
* No redirects
* Pass `h2: true` in options to use the HTTP2 protocol

---

For more details, please check tests (coverage: **>97%**) in the repository
