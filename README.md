The robust request library that humanity deserves 🌐
---
This package provides are highly likely functional and **easy-to-use** abstraction atop of
native [http(s).request](https://nodejs.org/api/http.html#http_http_request_url_options_callback).

## Prerequisites

* Node.js `>= 14.x`

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
