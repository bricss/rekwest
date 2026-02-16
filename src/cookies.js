import {
  brandCheck,
  toCamelCase,
} from './utils.js';

const lifetimeCap = 3456e7; // 400 days

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
    if (Array.isArray(input) && input.every((it) => !Array.isArray(it))) {
      input = input.map((it) => {
        if (!cookiesTTL) {
          return [it.split(';')[0].trim()];
        }

        const [cookie, ...attrs] = it.split(';').map((it) => it.trim());
        const ttl = {};

        for (const attr of attrs) {
          if (/(?:expires|max-age)=/i.test(attr)) {
            const [key, val] = attr.toLowerCase().split('=');
            const ms = Number.isFinite(Number.parseInt(val, 10)) ? val * 1e3 : Date.parse(val) - Date.now();

            ttl[toCamelCase(key)] = Math.min(ms, lifetimeCap);
          }
        }

        return [
          cookie.replace(/\u0022/g, ''),
          Object.keys(ttl).length ? ttl : null,
        ];
      });
    }

    super(Array.isArray(input) ? input.map((it) => it[0]).join('&') : input);

    if (Array.isArray(input) && cookiesTTL) {
      for (const [cookie, ttl] of input.filter((it) => it[1])) {
        const key = cookie.split('=')[0];

        if (this.#chronometry.has(key)) {
          clearTimeout(this.#chronometry.get(key));
          this.#chronometry.delete(key);
        }

        const { expires, maxAge } = ttl;

        for (const ms of [
          maxAge,
          expires,
        ]) {
          if (!Number.isInteger(ms)) {
            continue;
          }

          const ref = new WeakRef(this);
          const tid = setTimeout(() => {
            const ctx = ref.deref();

            if (ctx) {
              ctx.#chronometry.delete(key);
              ctx.delete(key);
            }
          }, Math.max(ms, 0));

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
