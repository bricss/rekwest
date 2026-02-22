import { File } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import http2 from 'node:http2';
import {
  APPLICATION_OCTET_STREAM,
  MULTIPART_FORM_DATA,
} from './mediatypes.js';
import {
  brandCheck,
  isBlobLike,
  isPipeStream,
  isReadableStream,
  tap,
} from './utils.js';

const CRLF = '\r\n';
const {
  HTTP2_HEADER_CONTENT_DISPOSITION,
  HTTP2_HEADER_CONTENT_TYPE,
} = http2.constants;

export class FormData {

  static #ensureArgs(args, expect, method) {
    if (args.length < expect) {
      throw new TypeError(`Failed to execute '${ method }' on '${
        this[Symbol.toStringTag]
      }': ${ expect } arguments required, but only ${ args.length } present`);
    }

    if (method === 'forEach') {
      if (args[0]?.constructor !== Function) {
        throw new TypeError(`Failed to execute '${ method }' on '${
          this[Symbol.toStringTag]
        }': parameter ${ expect } is not of type 'Function'`);
      }
    }
  }

  static #formEntry(name, value, filename) {
    name = String(name).toWellFormed();
    filename &&= String(filename).toWellFormed();

    if (isBlobLike(value)) {
      filename ??= String(value.name ?? 'blob').toWellFormed();
      value = new File([value], filename, value);
    } else if (isPipeStream(value) || isReadableStream(value)) {
      value.name = filename ?? 'blob';
    } else {
      value = String(value).toWellFormed();
    }

    return {
      name,
      value,
    };
  }

  #entries = [];

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }

  constructor(input) {
    if (Object(input) === input) {
      if (Array.isArray(input)) {
        if (!input.every((it) => Array.isArray(it))) {
          throw new TypeError(`Failed to construct '${
            this[Symbol.toStringTag]
          }': The provided value cannot be converted to a sequence`);
        }

        if (!input.every((it) => it.length === 2)) {
          throw new TypeError(`Failed to construct '${
            this[Symbol.toStringTag]
          }': Sequence initializer must only contain pair elements`);
        }
      } else if (!Reflect.has(input, Symbol.iterator)) {
        input = Object.entries(input);
      }

      for (const [key, val] of input) {
        this.append(key, val);
      }
    }
  }

  append(...args) {
    brandCheck(this, FormData);
    this.constructor.#ensureArgs(args, 2, this.append.name);
    this.#entries.push(this.constructor.#formEntry(...args));
  }

  delete(...args) {
    brandCheck(this, FormData);
    this.constructor.#ensureArgs(args, 1, this.delete.name);
    const name = String(args[0]).toWellFormed();

    this.#entries = this.#entries.filter((it) => it.name !== name);
  }

  forEach(...args) {
    brandCheck(this, FormData);
    this.constructor.#ensureArgs(args, 1, this.forEach.name);
    const [callback, thisArg] = args;

    for (const entry of this) {
      Reflect.apply(callback, thisArg, [
        ...entry.reverse(),
        this,
      ]);
    }
  }

  get(...args) {
    brandCheck(this, FormData);
    this.constructor.#ensureArgs(args, 1, this.get.name);
    const name = String(args[0]).toWellFormed();

    return this.#entries.find((it) => it.name === name)?.value ?? null;
  }

  getAll(...args) {
    brandCheck(this, FormData);
    this.constructor.#ensureArgs(args, 1, this.getAll.name);
    const name = String(args[0]).toWellFormed();

    return this.#entries.filter((it) => it.name === name).map((it) => it.value);
  }

  has(...args) {
    brandCheck(this, FormData);
    this.constructor.#ensureArgs(args, 1, this.has.name);
    const name = String(args[0]).toWellFormed();

    return !!this.#entries.find((it) => it.name === name);
  }

  set(...args) {
    brandCheck(this, FormData);
    this.constructor.#ensureArgs(args, 2, this.set.name);
    const entry = this.constructor.#formEntry(...args);
    const idx = this.#entries.findIndex((it) => it.name === entry.name);

    if (idx !== -1) {
      this.#entries.splice(idx, 1, entry);
    } else {
      this.#entries.push(entry);
    }
  }

  * entries() {
    brandCheck(this, FormData);
    for (const { name, value } of this.#entries) {
      yield [
        name,
        value,
      ];
    }
  }

  * keys() {
    brandCheck(this, FormData);
    for (const [name] of this) {
      yield name;
    }
  }

  * values() {
    brandCheck(this, FormData);
    for (const [, val] of this) {
      yield val;
    }
  }

  [Symbol.iterator]() {
    brandCheck(this, FormData);

    return this.entries();
  }

}

export const fdToAsyncIterable = (fd) => {
  const boundary = randomBytes(32).toString('hex');
  const contentType = `${ MULTIPART_FORM_DATA }; boundary=${ boundary }`;
  const prefix = `--${ boundary }${ CRLF }${ HTTP2_HEADER_CONTENT_DISPOSITION }: form-data`;

  const escape = (str) => str.replace(/\n/g, '%0A').replace(/\r/g, '%0D').replace(/"/g, '%22');
  const normalize = (str) => str.replace(/\r?\n|\r/g, CRLF);

  return {
    contentType,
    async* [Symbol.asyncIterator]() {
      const encoder = new TextEncoder();

      for (const [name, val] of fd) {
        if (val.constructor === String) {
          yield encoder.encode(`${ prefix }; name="${
            escape(normalize(name))
          }"${ CRLF.repeat(2) }${ normalize(val) }${ CRLF }`);
        } else {
          yield encoder.encode(`${ prefix }; name="${
            escape(normalize(name))
          }"${ val.name ? `; filename="${ escape(val.name) }"` : '' }${ CRLF }${
            HTTP2_HEADER_CONTENT_TYPE
          }: ${
            val.type || APPLICATION_OCTET_STREAM
          }${ CRLF.repeat(2) }`);
          yield* tap(val);
          yield new Uint8Array([
            13,
            10,
          ]);
        }
      }

      yield encoder.encode(`--${ boundary }--${ CRLF }`);
    },
  };
};

export const isFormData = (val) => FormData.name === val?.[Symbol.toStringTag];

export const parseFormData = (str) => {
  const rex = /^-+[^\r\n]+\r?\ncontent-disposition:\s*form-data;\s*name="(?<name>[^"]+)"(?:;\s*filename="(?<filename>[^"]+)")?(?:\r?\n[^\r\n:]+:[^\r\n]*)*\r?\n\r?\n(?<content>.*?)(?=\r?\n-+[^\r\n]+)/gims;

  return [...str.matchAll(rex)].map(({ groups }) => structuredClone(groups));
};
