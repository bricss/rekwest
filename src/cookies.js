import {
  brandCheck,
  toCamelCase,
} from './utils.js';

export const cookieExpiryRex = /(?:expires|max-age)=/i;
export const cookieIllegalCharsRex = /\p{Control}/u;
export const cookieLaxPairPattern = `[^=]+=(?:"[^"]*"|[^${ cookieIllegalCharsRex.source };]*)`;
export const cookieRex = new RegExp(
  String.raw`^${ cookieLaxPairPattern }(?:;\s*(?:${ cookieLaxPairPattern }|[^=]+))*$`,
  'u',
);
export const isValidCookie = (str) => typeof str === 'string' && cookieRex.test(str);
export const maxCookieByteSize = 4096;
export const maxCookieLifetimeCap = 3456e7; // 400 days
export const splitCookieKVRex = /=(?<v>.*)/s;
export const splitCookieToPairs = (str) => str.match(/[^;\s]+=(?:"[^"]*"|[^;]*)/g);

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
      input = splitCookieToPairs(input);
    }

    const ttlMap = new Map();

    if (Array.isArray(input) && input.every((it) => isValidCookie(it))) {
      input = input.filter((it) => !cookieIllegalCharsRex.test(it)).map(splitCookieToPairs)
                   .filter(([cookie]) => new Blob([cookie]).size <= maxCookieByteSize)
                   .map(([cookie, ...attrs]) => {
                     cookie = cookie.split(splitCookieKVRex, 2).map((it) => {
                       try {
                         return decodeURIComponent(it);
                       } catch {
                         return it;
                       }
                     });

                     if (cookiesTTL) {
                       for (const attr of attrs) {
                         if (cookieExpiryRex.test(attr)) {
                           const [key, val] = attr.split(splitCookieKVRex, 2);
                           let interval = val * 1e3 || Date.parse(val) - Date.now();

                           if (interval < 0 || Number.isNaN(interval)) {
                             interval = 0;
                           }

                           ttlMap.set(
                             cookie[0],
                             { [toCamelCase(key)]: Math.min(interval, maxCookieLifetimeCap) },
                           );
                         }
                       }
                     }

                     return cookie;
                   });
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

    return super.toString().split('&').join('; ');
  }

}
