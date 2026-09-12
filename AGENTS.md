# Agent's Guide

## Project Type

Zero-dependency HTTP client library for Node.js ≥22 (ESM). Wraps native `http`/`https`/`http2` modules with a
fetch-alike API. Publishes both ESM (`./src/index.js`) and CJS (`./dist/index.cjs`).

---

## Essential Commands

```bash
npm test                        # run full test suite (auto-generates certs first)
npm run test:cover              # coverage report via c8 (>97%)
npm run build                   # babel → dist/, then misc.sh
npm run lint                    # eslint with concurrency, auto-parallel md rules
npm run pretest                 # hook: rm coverage + openssl cert gen (P-384)
npm run prepack                 # build + lint before publish
```

---

## Architecture — Request Pipeline

The core request flow is a functional composition in `src/index.js`:

```
rekwest(url, options)
  → validation(options)    // method/body guard, enum checks
  → normalize(url, opts)   // merge defaults, URL parse, header/param normalization
  → transfer(opts)         // async: ackn(H2 detection), preflight, dispatch, postflight
```

### Pipeline Modules (single responsibility)

| Module                 | Purpose                                                  | Key exports                                                                                                                                                                                                                   |
|------------------------|----------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `mediatypes.js`        | RFC 9239 MIME type constants                             | `APPLICATION_FORM_URLENCODED`, `APPLICATION_JSON`, `APPLICATION_OCTET_STREAM`, `MULTIPART_FORM_DATA`, `TEXT_PLAIN`, `WILDCARD`                                                                                                |
| `config.js`            | Defaults + zstd availability check                       | `defaults`, `isZstdSupported`                                                                                                                                                                                                 |
| `errors.js`            | Custom error class hierarchy                             | `RequestError`, `TimeoutError extends Error`                                                                                                                                                                                  |
| `validation.js`        | Input guards                                             | `validation()` — throws on bad method/body or invalid enums                                                                                                                                                                   |
| `utils.js` (normalize) | URL/param/header normalization, stream & brand utilities | `normalize()`, `addSearchParams()`, `augment()`, `snoop()`, `deepMerge()`, `dispatch()`, `cloneWith()`, `stripHeaders()`, `tap()`, `normalizeHeaders()`, plus guards (`isBlobLike()`, `isPipeStream()`, `isReadableStream()`) |
| `preflight.js`         | H2 header injection, cookie attach, cred stripping       | `preflight()` — strips pseudo-headers for H1, adds them for H2                                                                                                                                                                |
| `formdata.js`          | Streamable FormData interface + helpers                  | `FormData` (append/get/...), `fdToAsyncIterable()`, `isFormData()`, `parseFormData()`                                                                                                                                         |
| `transform.js`         | Body transformation (Blob/FormData/streams → Buffer)     | `transform()` — sets content-type/length, converts JSON string bodies                                                                                                                                                         |
| `transfer.js`          | Orchestrates the full async request cycle                | `transfer()` — retry loop, protocol negotiation                                                                                                                                                                               |
| `postflight.js`        | Response processing: redirects, cookies, error routing   | `postflight()`                                                                                                                                                                                                                |
| `redirects.js`         | Recursive redirect following with cred rules             | `redirects()` — returns Promise or void                                                                                                                                                                                       |
| `retries.js`           | Exponential backoff with log-uniform strategy            | `retries()`                                                                                                                                                                                                                   |
| `codecs.js`            | Request/response body encoding/decoding pipelines        | `encode()`, `decode()` (br/gzip/zstd/deflate)                                                                                                                                                                                 |
| `mixin.js`             | Response object augmentation (`body()`, `json()`, etc.)  | `mixin()` — fetch-alike methods when `digest: false`                                                                                                                                                                          |
| `cookies.js`           | Cookie jar with TTL support                              | `Cookies` class, singleton `.jar` (global state)                                                                                                                                                                              |
| `ackn.js`              | ALPN protocol negotiation probe for HTTPS                | `ackn()` — returns options object or throws                                                                                                                                                                                   |

### Key Files

- **Entry**: `src/index.js` — default export `rekwest()`, static `.defaults` getter/setter, `.extend()` factory,
  `.stream()` raw stream mode
- **Constants**: `src/constants.js` — enums for credentials/redirect modes; re-exports Node's `http2.constants` as named
  exports

---

## Test Setup & Architecture

### Test Infrastructure

Tests use Mocha with global setup/teardown (`test/fixtures/index.js`). Before each test run:

1. `npm run cert:gen` — generates self-signed TLS cert+key for localhost (P-384)
2. Four servers start simultaneously: **h1c** (plain HTTP :1081), **h1s** (TLS HTTP/1.1 :1083), **h2c** (HTTP/2 :2000),
   **h2s** (TLS H2 :2443)

### Test Fixtures

`test/fixtures/routes.js` — mock server with `/gimme/*` endpoints that exercise every feature:

- `/gimme/json`, `/gimme/text`, `/gimme/encode` — basic responses
- `/gimme/cookies` — cookie echo and set-cookie headers (supports `?expires`, `?maxAge`)
- `/gimme/redirect` — 301/302/303 redirects with configurable location, retry-after, and status codes
- `/gimme/reset` — destroys response stream on the first hit (tests retry)
- `/gimme/retry` — returns 429 then 200 (tests retry logic and Retry-After parsing)
- `/gimme/repulse` — echo body back (tests all body types)
- `/gimme/squash` — decode→reverse→encode pipeline test

### Test Patterns

- Tests are organized as a factory function (`test/index.suite.js`) parameterized by `{ baseURL, httpVersion }` — called
  once per server type for H1/H2 coverage
- Cookie jar is cleared in `after()` hook; TTL tests use `scheduler.wait()` with precise timing
- Stream body redirect tests verify both success (with `bufferBody: true`) and failure without buffering

---

## Code Conventions

- **Naming**: camelCase throughout. Constants are UPPER_SNAKE_CASE from Node's `http2.constants`. Local enums use object
  shorthand (`requestCredentials`, `requestRedirect`).
- **Headers**: Always accessed via `HTTP2_HEADER_*` constants (even for HTTP/1.x code paths). H2 pseudo-headers (
  `:authority`, `:method`, `:path`, `:scheme`) are injected in `preflight()`.
- **URL handling**: All URLs converted to `new URL()` early. Search params appended via `addSearchParams()`. Trailing
  slash trimming is opt-in.
- **Error handling**: Custom error class hierarchy — `RequestError extends Error` → `TimeoutError extends RequestError`.
  Errors thrown from response handlers use `.emit('error')` pattern for stream compatibility.
- **Stream bodies**: Checked with `isReadable()` (Node's `stream.Readable`). Pipe streams (`isPipeStream`) cannot
  redirect without buffering.
- **Brand checking**: `brandCheck(val, ctor)` enforces instance checks on fetch-alike response methods to prevent
  cross-realm misuse.
- **AbortSignal passthrough** — `signal` is passed through to the native Node.js HTTP request; `'aborted'` event
  rejection is handled in `snoop()`. Works identically to calling `http.request({ signal })` directly.
- **Agent / proxy passthrough** — `agent` option (and all other raw options) flow through to the native Node.js
  HTTP/HTTPS client, so proxies are supported via any standard agent (e.g., `proxy-agent`).

---

## Gotchas & Non-Obvious Behavior

1. **Global cookie state** — `Cookies.jar` is a singleton shared across all requests. Tests must clean up in `after()`
   hooks. This is intentional (fetch-alike behavior) but means concurrent requests share cookies.
2. **H2 auto-detection** — For HTTPS URLs without explicit `h2: true`, `ackn()` probes the server's ALPN negotiation
   before making the request. If the H2C preface error occurs (`HPE_INVALID_CONSTANT`), it retries with `h2: true`. This
   is
   transparent to callers.
3. **Cross-origin redirect drops credentials** — When following a cross-origin redirect, `credentials` is automatically
   set to `'omit'` and `h2` is reset to `false`. The `allowDowngrade` option must be explicitly enabled for https→http
   redirects.
4. **Zstd availability** — `isZstdSupported` is checked at import time against `zlib.constants.ZSTD_CLEVEL_DEFAULT`.
   Node versions without ZSTD silently strip it from accept headers.
5. **Body parsing depends on MIME type detection** — Uses `node:util.MIMEType` for RFC 9239 compliant parsing. Textual
   types are decoded; JSON is auto-parsed. Binary remains as Buffer when `parse: true`.
6. **Response stream consumption** — `bodyUsed` is backed by `readableEnded` (stream internal state). Once the stream
   ends, any subsequent `body()` call throws `"Response stream already read"`. This is intentional and tested.
7. **`.extend()` returns a closure** — Not a new constructor; it's a function that merges options via
   `structuredClone() + deepMerge()` on each call. Defaults are never mutated.
8. **`thenable: true` suppresses errors** — When set, rejected promises resolve with the error object instead of
   throwing. Useful for non-fatal HTTP errors (4xx/5xx).
9. **Global cookie jar matches browser behavior** — `Cookies.jar` is intentionally shared across all instances,
   just like a single-browser cookie store. Concurrent requests from different `.extend()` clients share cookies;
   this is by design, not a side effect.
10. **`backoffStrategy` uses string evaluation (security risk)** — In `retries.js:39`, the retry interval formula is
    evaluated via a `vm.Script` (`new Script(...)` from `node:vm`). Any user-controlled value passed as
    `retry.backoffStrategy` executes arbitrary code.
    Use only trusted/static values; never accept this option from untrusted input.

### Certificate Pinning (Security)

- **`certPins`** option (`{string[]}`, default `[]`) — a list of SHA-256 fingerprints (colon-separated hex) for HTTPS
  pinning, implemented in `ackn.js`. A connection is rejected when the list is non-empty and none matches.
  - Non-obvious gotcha: on **TLS session resumption** the check is skipped (`!socket.isSessionReused()`), so a
    resumed/sessions-resumed connection will pass even if pins mismatch.

---

## Configuration & Build

- Babel compiles `src/*` → `dist/*` with `.cjs` extension for CJS consumers
- `misc.sh` is a post-babel script invoked from `build` — rewrites `.js` require extensions to `.cjs` in dist output
- ESLint config uses `eslint-config-ultra-refined` + `@eslint/markdown` (concurrent execution)
- `.npmrc` sets `install-strategy=linked`; affects local npm install behavior
- Retry backoff strategy defaults to a string formula evaluated at runtime:
  `interval * Math.log(Math.random() * (Math.E * Math.E - Math.E) + Math.E)`

---

## Known Limitations & Future Work

| Gap                                   | Details                                                                                                                                                                                                                          |
|---------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **No Request/Response classes**       | Options passed as plain objects rather than spec-compliant `Request` / `Response` constructors. Missing middleware-chain compatibility. Static factories (`Response.json()`, `Response.error()`, `Request.clone()`) also absent. |
| **No request/response interceptors**  | Missing middleware pipeline (like Axios interceptors) for global transform hooks (auth injection, logging, metrics).                                                                                                             |
| **`res.body` returns Node.js stream** | Not a Web-compatible `ReadableStream`; limits interoperability with web-streams-aware libraries and edge runtimes.                                                                                                               |
