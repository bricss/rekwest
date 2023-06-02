import {
  brandCheck,
  toCamelCase,
} from './utils.mjs';

export class Cookies extends URLSearchParams {

  static jar = new Map();

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
        const ttl = attrs.reduce((acc, val) => {
          if (/(?:Expires|Max-Age)=/i.test(val)) {
            const [key, value] = val.toLowerCase().split('=');

            acc[toCamelCase(key)] = !Number.isNaN(Number(value)) ? value * 1e3 : Date.parse(value) - Date.now();
          }

          return acc;
        }, {});

        return [
          cookie.replace(/\u0022/g, ''),
          Object.keys(ttl).length ? ttl : null,
        ];
      });
    }

    super(Array.isArray(input) ? input.map((it) => it.at(0)).join('&') : input);

    if (Array.isArray(input) && cookiesTTL) {
      input.filter((it) => it.at(1)).forEach(([cookie, ttl]) => {
        cookie = cookie.split('=').at(0);
        if (this.#chronometry.has(cookie)) {
          clearTimeout(this.#chronometry.get(cookie));
          this.#chronometry.delete(cookie);
        }

        const { expires, maxAge } = ttl;

        [
          maxAge,
          expires,
        ].filter((it) => Number.isInteger(it)).some((ms) => {
          const tid = setTimeout(() => {
            this.#chronometry.delete(cookie);
            this.delete(cookie);
          }, Math.max(ms, 0));

          return this.#chronometry.set(cookie, tid);
        });
      });
    }
  }

  toString() {
    brandCheck(this, Cookies);

    return super.toString().split('&').join('; ').trim();
  }

}
