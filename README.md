The robust request library that humanity deserves 🌐
---
This package provides highly likely functional and **easy-to-use** abstraction atop of
native [http(s).request](https://nodejs.org/api/https.html#https_https_request_url_options_callback)
and [http2.request](https://nodejs.org/api/http2.html#http2_clienthttp2session_request_headers_options).

## Abstract

* Fetch-alike
* Cool-kids config options (with defaults)
* Automatic HTTP2 support (ALPN negotiation)
* Automatic or opt-in body parse (with non-UTF-8 charset decoding)
* Automatic and simplistic cookie(s) treatment (with built-in jar)
* Automatic decompression (with opt-in body compression)
* Support redirects with fine-grained tune-ups
* Support all legit request body types (include blobs & streams)
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
import rekwest from 'rekwest';

const url = 'https://somewhe.re/somewhat/endpoint';
const res = await rekwest(url);

console.log(res.body);
```

### API

#### `rekwest(url[, options])`

* `url` **{string | URL}** The URL to send the request to
* `options` **{Object}**
  Extends [http.RequestOptions](https://nodejs.org/api/https.html#https_https_request_url_options_callback)
  * `body` **{string | Array | Blob | Object | ReadableStream | URLSearchParams}** Body to send with request
  * `cookies` **{boolean | Object}** `Default: true` Cookies to add to request
  * `digest` **{boolean}** `Default: true` Read response stream, or simply add a mixin
  * `follow` **{number}** `Default: 20` Number of redirects to follow
  * `h2` **{boolean}** `Default: false` Force use of HTTP2 protocol
  * `parse` **{boolean}** `Default: true` Parse response body, or return a buffer
  * `redirect` **{false | follow | error}** `Default: 'follow'` Controls redirect flow
  * `thenable` **{boolean}** `Default: false` Controls promise resolutions
* **Returns:** Promise that resolves to
  extended [http.IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage) which is readable
  stream
  * if `degist: true` & `parse: true`
    * `body` **{string | Buffer | Object}** Body based on its content type
  * if `degist: false`
    * `arrayBuffer` **{AsyncFunction}** Reads the response and returns **ArrayBuffer**
    * `blob` **{AsyncFunction}** Reads the response and returns **Blob**
    * `body` **{AsyncFunction}** Reads the response and returns **Buffer** if `parse: false`
    * `json` **{AsyncFunction}** Reads the response and returns **Object**
    * `text` **{AsyncFunction}** Reads the response and returns **String**
  * `bodyUsed` **{boolean}** Whether the response were read or not
  * `cookies` **{undefined | Object}** Cookies sent and received with the response
  * `httpVersion` **{1 | 2}** Indicates protocol version negotiated with the server
  * `ok` **{boolean}** Indicates if the response was successful (statusCode: **200-299**)
  * `redirected` **{boolean}** Indicates if the response is the result of a redirect

---

#### `rekwest.defaults`

Object to fill with default [options](#rekwesturl-options)

---

#### `rekwest.stream(url[, options])`

Method to use with streams and pipes  
Pass `h2: true` in options to use HTTP2 protocol

---

For more details please check tests in the repository
