import { Blob } from 'buffer';

export { Blob } from 'buffer';

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

  constructor(bits, name = 'blob', options = {}) {
    const {
      name: filename,
      lastModified = Date.now(),
    } = options;

    super(bits, options);
    this.#lastModified = lastModified;
    this.#name = filename || name;
  }

}
