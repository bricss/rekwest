The robust request library that humanity deserves 🌐
---
This package provides highly likely functional and **easy-to-use** abstraction atop of
native [http(s).request](https://nodejs.org/api/https.html#https_https_request_url_options_callback).

## Abstract

* Fetch-alike
* Cool-kids config options (with defaults)
* Automatic or opt-in body parse (with non-UTF-8 charset decoding)
* Automatic and simplistic cookie(s) treatment (with built-in jar)
* Automatic decompression (with opt-in body compression)
* Support redirects with fine-grained tune-ups
* Support all legit request body types (include blob & streams)
* Fully promise-able and pipe-able
* Future HTTP2 support?
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
  * `body` **{string | Array | Blob | Object | Stream}** Body to send with request
  * `cookies` **{boolean | Object}** `Default: true` Cookies to add to request
  * `digest` **{boolean}** `Default: true` Read response stream, or simply add a mixin
  * `follow` **{number}** `Default: 20` Number of redirects to follow
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
  * `ok` **{boolean}** Indicates if the response was successful (statusCode: **200-299**)
  * `redirected` **{boolean}** Indicates if the response is the result of a redirect

---

#### `rekwest.defaults`

Object to fill with default [options](#rekwesturl-options)

---

#### `rekwest.stream(url[, options][, callback])`

Method to use with streams and pipes

---

For more details please check tests in the repository
