import { brandCheck } from './utils.mjs';

export class Cookies extends URLSearchParams {

  static jar = new Map();

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }

  constructor(input) {
    if (Array.isArray(input) && input.every((it) => !Array.isArray(it))) {
      input = input.join(';').split(';')
                   .filter((it) => !/\b(?:Domain|Expires|HttpOnly|Max-Age|Path|SameParty|SameSite|Secure)\b/i.test(it))
                   .map((it) => it.trim())
                   .join('&');
    }

    super(input);
  }

  toString() {
    brandCheck(this, Cookies);

    return super.toString().split('&').join('; ').trim();
  }

}
