import {
  brandCheck,
  toCamelCase,
} from './utils.mjs';

const lifetimeCap = 3456e7; // 400 days

export class Cookies extends URLSearchParams {

  static #finalizers = new Set();
  static jar = new Map();

  static #register(target, value) {
    const finalizer = new FinalizationRegistry((heldValue) => {
      clearTimeout(heldValue);
      this.#finalizers.delete(finalizer);
    });

    finalizer.register(target, value);
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
          return [it.split(';').at(0).trim()];
        }

        const [cookie, ...attrs] = it.split(';').map((it) => it.trim());
        const ttl = {};

        for (const val of attrs) {
          if (/(?:Expires|Max-Age)=/i.test(val)) {
            const [key, value] = val.toLowerCase().split('=');
            const ms = Number.isFinite(Number(value)) ? value * 1e3 : Date.parse(value) - Date.now();

            ttl[toCamelCase(key)] = Math.min(ms, lifetimeCap);
          }
        }

        return [
          cookie.replace(/\u0022/g, ''),
          Object.keys(ttl).length ? ttl : null,
        ];
      });
    }

    super(Array.isArray(input) ? input.map((it) => it.at(0)).join('&') : input);

    if (Array.isArray(input) && cookiesTTL) {
      for (const [cookie, ttl] of input.filter((it) => it.at(1))) {
        const key = cookie.split('=').at(0);

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
