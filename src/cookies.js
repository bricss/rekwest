import {
  brandCheck,
  toCamelCase,
} from './utils.js';

export const cookieRex = /^[\w-]+=(?:"[^"]*"|[^\p{Control};]*)(?:;\s*(?:[\w-]+=(?:"[^"]*"|[^\p{Control};]*)|[\w-]+))*$/u;
export const cookiePairRex = /(?:[^;"\s]+="[^"]*"|[^;]+)(?=;|$)/g;
export const illegalCookieChars = /\p{Control}/u;
export const isValidCookie = (str) => str?.constructor === String && cookieRex.test(str);
export const maxCookieLifetimeCap = 3456e7; // 400 days
export const maxCookieSize = 4096;
export const splitCookie = (str) => str.match(cookiePairRex).map((str) => str.trim());

export class Cookies extends URLSearchParams {

  static #finalizers = new Set();
  static jar = new Map();

  static #register(target, val) {
    const finalizer = new FinalizationRegistry((heldVal) => {
      clearTimeout(heldVal);
      this.#finalizers.delete(finalizer);
    });

    finalizer.register(target, val);
    this.#finalizers.add(finalizer);
  }

  #chronometry = new Map();

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }

  constructor(input, { cookiesTTL } = { cookiesTTL: false }) {
    if (isValidCookie(input)) {
      input = splitCookie(input);
    }

    const ttlMap = new Map();

    if (Array.isArray(input)) {
      if (input.every((it) => isValidCookie(it))) {
        input = input.filter((it) => !illegalCookieChars.test(it) && it.length <= maxCookieSize);
        input = input.map(splitCookie).map(([cookie, ...attrs]) => {
          try {
            cookie = cookie.split('=').map((it) => decodeURIComponent(it.trim()));

            return cookie;
          } finally {
            if (cookiesTTL) {
              for (const attr of attrs) {
                if (/(?:expires|max-age)=/i.test(attr)) {
                  const [key, val] = attr.toLowerCase().split('=');
                  let interval = val * 1e3 || Date.parse(val) - Date.now();

                  if (interval < 0 || Number.isNaN(interval)) {
                    interval = 0;
                  }

                  ttlMap.set(
                    cookie[0],
                    { [toCamelCase(key.trim())]: Math.min(interval, maxCookieLifetimeCap) },
                  );
                }
              }
            }
          }
        });
      }
    }

    super(input);

    if (ttlMap.size) {
      for (const [key, attrs] of ttlMap) {

        if (this.#chronometry.has(key)) {
          clearTimeout(this.#chronometry.get(key));
          this.#chronometry.delete(key);
        }

        const { expires, maxAge } = attrs;

        for (const interval of [
          maxAge,
          expires,
        ]) {
          if (!Number.isInteger(interval)) {
            continue;
          }

          const ref = new WeakRef(this);
          const tid = setTimeout(() => {
            const ctx = ref.deref();

            if (ctx) {
              ctx.#chronometry.delete(key);
              ctx.delete(key);
            }
          }, Math.max(interval, 0));

          this.constructor.#register(this, tid);
          this.#chronometry.set(key, tid);
          break;
        }
      }
    }
  }

  toString() {
    brandCheck(this, Cookies);

    return super.toString().split('&').join('; ').trim();
  }

}
