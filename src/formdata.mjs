import { randomBytes } from 'node:crypto';
import http2 from 'node:http2';
import { toUSVString } from 'node:util';
import { File } from './file.mjs';
import {
  APPLICATION_OCTET_STREAM,
  MULTIPART_FORM_DATA,
} from './mediatypes.mjs';
import {
  collate,
  tap,
} from './utils.mjs';

const CRLF = '\r\n';
const {
  HTTP2_HEADER_CONTENT_DISPOSITION,
  HTTP2_HEADER_CONTENT_TYPE,
} = http2.constants;

export class FormData {

  static actuate(fd) {
    const boundary = randomBytes(24).toString('hex');
    const contentType = `${ MULTIPART_FORM_DATA }; boundary=${ boundary }`;
    const prefix = `--${ boundary }${ CRLF }${ HTTP2_HEADER_CONTENT_DISPOSITION }: form-data`;

    const escape = (str) => str.replace(/\n/g, '%0A').replace(/\r/g, '%0D').replace(/"/g, '%22');
    const normalize = (value) => value.replace(/\r?\n|\r/g, CRLF);

    return {
      contentType,
      async* [Symbol.asyncIterator]() {
        const encoder = new TextEncoder();

        for (const [name, value] of fd) {
          if (value.constructor === String) {
            yield encoder.encode(`${ prefix }; name="${
              escape(normalize(name))
            }"${ CRLF.repeat(2) }${ normalize(value) }${ CRLF }`);
          } else {
            yield encoder.encode(`${ prefix }; name="${
              escape(normalize(name))
            }"${ value.name ? `; filename="${ escape(value.name) }"` : '' }${ CRLF }${
              HTTP2_HEADER_CONTENT_TYPE
            }: ${
              value.type || APPLICATION_OCTET_STREAM
            }${ CRLF.repeat(2) }`);
            yield* tap(value);
            yield encoder.encode(CRLF);
          }
        }

        yield encoder.encode(`--${ boundary }--`);
      },
    };
  }

  static alike(instance) {
    return instance?.constructor.name === FormData.name;
  }

  static #enfoldEntry(name, value, filename) {
    name = toUSVString(name);
    filename &&= toUSVString(filename);

    if (File.alike(value)) {
      filename ??= value.name || 'blob';
      value = new File([value], filename, value);
    } else if (this.#ensureInstance(value)) {
      value.name = filename;
    } else {
      value = toUSVString(value);
    }

    return {
      name,
      value,
    };
  }

  static #ensureInstance(value) {
    return File.alike(value) || (value === Object(value) && Reflect.has(value, Symbol.asyncIterator));
  }

  #entries = [];

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }

  constructor(input) {
    if (input === Object(input)
      && (input?.constructor === Object || Reflect.has(input, Symbol.iterator))) {

      if (input.constructor !== Object) {
        input = Array.from(input);
      }

      if (Array.isArray(input)) {
        if (!input.every((it) => Array.isArray(it))) {
          throw new TypeError(`Failed to construct '${
            this[Symbol.toStringTag]
          }': The provided value cannot be converted to a sequence.`);
        } else if (!input.every((it) => it.length === 2)) {
          throw new TypeError(`Failed to construct '${
            this[Symbol.toStringTag]
          }': Sequence initializer must only contain pair elements.`);
        }
      }

      if (input.constructor === Object) {
        input = Object.entries(input);
      }

      input.forEach(([key, value]) => this.append(key, value));
    }
  }

  #ensureArgs(args, expected, method) {
    if (args.length < expected) {
      throw new TypeError(`Failed to execute '${ method }' on '${
        this[Symbol.toStringTag]
      }': ${ expected } arguments required, but only ${ args.length } present.`);
    }

    if ([
      'append',
      'set',
    ].includes(method)) {
      if (args.length === 3 && !this.constructor.#ensureInstance(args[1])) {
        throw new TypeError(`Failed to execute '${ method }' on '${
          this[Symbol.toStringTag]
        }': parameter ${ expected } is not of type 'Blob'.`);
      }
    }

    if (method === 'forEach') {
      if (args[0]?.constructor !== Function) {
        throw new TypeError(`Failed to execute '${ method }' on '${
          this[Symbol.toStringTag]
        }': parameter ${ expected } is not of type 'Function'.`);
      }
    }
  }

  append(...args) {
    collate(this, FormData);
    this.#ensureArgs(args, 2, 'append');
    this.#entries.push(this.constructor.#enfoldEntry(...args));
  }

  delete(...args) {
    collate(this, FormData);
    this.#ensureArgs(args, 1, 'delete');
    const name = toUSVString(args[0]);

    this.#entries = this.#entries.filter((it) => it.name !== name);
  }

  forEach(...args) {
    collate(this, FormData);
    this.#ensureArgs(args, 1, 'forEach');
    const [callback, thisArg] = args;

    for (const entry of this) {
      Reflect.apply(callback, thisArg, [
        ...entry.reverse(),
        this,
      ]);
    }
  }

  get(...args) {
    collate(this, FormData);
    this.#ensureArgs(args, 1, 'get');
    const name = toUSVString(args[0]);

    return (this.#entries.find((it) => it.name === name) ?? {}).value ?? null;
  }

  getAll(...args) {
    collate(this, FormData);
    this.#ensureArgs(args, 1, 'getAll');
    const name = toUSVString(args[0]);

    return this.#entries.filter((it) => it.name === name).map((it) => it.value);
  }

  has(...args) {
    collate(this, FormData);
    this.#ensureArgs(args, 1, 'has');
    const name = toUSVString(args[0]);

    return !!this.#entries.find((it) => it.name === name);
  }

  set(...args) {
    collate(this, FormData);
    this.#ensureArgs(args, 2, 'set');
    const entry = this.constructor.#enfoldEntry(...args);
    const idx = this.#entries.findIndex((it) => it.name === entry.name);

    if (idx !== -1) {
      this.#entries.splice(idx, 1, entry);
    } else {
      this.#entries.push(entry);
    }
  }

  * entries() {
    collate(this, FormData);
    for (const { name, value } of this.#entries) {
      yield [
        name,
        value,
      ];
    }
  }

  * keys() {
    collate(this, FormData);
    for (const [name] of this) {
      yield name;
    }
  }

  * values() {
    collate(this, FormData);
    for (const [, value] of this) {
      yield value;
    }
  }

  [Symbol.iterator]() {
    collate(this, FormData);

    return this.entries();
  }

}
