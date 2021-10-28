export class Cookies extends URLSearchParams {

  static jar = new Map();

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }

  constructor(input) {
    if (Array.isArray(input) && !input.every((it) => Array.isArray(it))) {
      input = input.join(';').split(';').map((it) => it.trim())
                   .filter((it) => !/\b(Domain|Expires|HttpOnly|Max-Age|Path|SameSite|Secure)\b/i.test(it))
                   .join('&');
    }

    super(input);
  }

  toString() {
    return super.toString().split('&').join('; ').trim();
  }

}
