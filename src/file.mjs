import { Blob } from 'node:buffer';
import { toUSVString } from 'node:util';

export { Blob } from 'node:buffer';

export class File extends Blob {

  static alike(instance) {
    return [
      Blob.name,
      File.name,
    ].includes(instance?.constructor.name);
  }

  #lastModified;
  #name;

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }

  get lastModified() {
    return this.#lastModified;
  }

  get name() {
    return this.#name;
  }

  constructor(...args) {
    const len = args.length;

    if (len < 2) {
      throw new TypeError(`Failed to construct '${
        File.name
      }': 2 arguments required, but only ${ len } present.`);
    }

    const [bits, name, options = {}] = args;
    const {
      lastModified = Date.now(),
    } = options;

    super(bits, options);
    this.#lastModified = +lastModified ? lastModified : 0;
    this.#name = toUSVString(name);
  }

}
