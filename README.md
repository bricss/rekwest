The robust request library that humanity deserves 🌐
---
This package provides are highly likely functional and **easy-to-use** abstraction atop of
native [http(s).request](https://nodejs.org/api/https.html#https_https_request_url_options_callback).

## Abstract

* Fetch-alike
* Cool-kids config options
* Automatic or opt-in body parse (with non-UTF-8 charset decoding)
* Automatic decompression (with opt-in body compression)
* Support redirects with fine-grained tune ups
* Support any legit type of request body (streams included)
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

const url = 'https://somewhe.re/wat';
const res = await rekwest(url);

console.log(res.body);
```
