import { randomBytes } from 'crypto';
import http2 from 'http2';
import { toUSVString } from 'util';
import { File } from './file.mjs';
import { tap } from './helpers.mjs';
import {
  APPLICATION_OCTET_STREAM,
  MULTIPART_FORM_DATA,
} from './mediatypes.mjs';

const {
  HTTP2_HEADER_CONTENT_DISPOSITION,
  HTTP2_HEADER_CONTENT_TYPE,
} = http2.constants;

export class FormData {

  static actuate(fd) {
    const boundary = randomBytes(24).toString('hex');
    const contentType = `${ MULTIPART_FORM_DATA }; boundary=${ boundary }`;
    const prefix = `--${ boundary }\r\n${ HTTP2_HEADER_CONTENT_DISPOSITION }: form-data`;

    const escape = (str) => str.replace(/\n/g, '%0A').replace(/\r/g, '%0D').replace(/"/g, '%22');
    const normalize = (value) => value.replace(/\r?\n|\r/g, '\r\n');

    return {
      contentType,
      async* [Symbol.asyncIterator]() {
        const encoder = new TextEncoder();

        for (const [name, value] of fd) {
          if (value.constructor === String) {
            yield encoder.encode(`${ prefix }; name="${
              escape(normalize(name))
            }"\r\n\r\n${ normalize(value) }\r\n`);
          } else {
            yield encoder.encode(`${ prefix }; name="${
              escape(normalize(name))
            }"${ value.name ? `; filename="${ escape(value.name) }"` : '' }\r\n${
              HTTP2_HEADER_CONTENT_TYPE
            }: ${
              value.type || APPLICATION_OCTET_STREAM
            }\r\n\r\n`);
            yield* tap(value);
            yield encoder.encode('\r\n');
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
        }': parameter ${ expected } is not of type 'Blob', 'File' or async iterable.`);
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
    this.#ensureArgs(args, 2, 'append');
    this.#entries.push(this.constructor.#enfoldEntry(...args));
  }

  delete(...args) {
    this.#ensureArgs(args, 1, 'delete');
    const name = toUSVString(args[0]);

    this.#entries = this.#entries.filter((it) => it.name !== name);
  }

  forEach(...args) {
    this.#ensureArgs(args, 1, 'forEach');
    const [callback, thisArg] = args;

    for (const entry of this) {
      Reflect.apply(callback, thisArg, [
        ...(entry.reverse()),
        this,
      ]);
    }
  }

  get(...args) {
    this.#ensureArgs(args, 1, 'get');
    const name = toUSVString(args[0]);

    return (this.#entries.find((it) => it.name === name) ?? {}).value ?? null;
  }

  getAll(...args) {
    this.#ensureArgs(args, 1, 'getAll');
    const name = toUSVString(args[0]);

    return this.#entries.filter((it) => it.name === name).map((it) => it.value);
  }

  has(...args) {
    this.#ensureArgs(args, 1, 'has');
    const name = toUSVString(args[0]);

    return !!this.#entries.find((it) => it.name === name);
  }

  set(...args) {
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
    for (const { name, value } of this.#entries) {
      yield [
        name,
        value,
      ];
    }
  }

  * keys() {
    for (const [name] of this) {
      yield name;
    }
  }

  * values() {
    for (const [, value] of this) {
      yield value;
    }
  }

  [Symbol.iterator]() {
    return this.entries();
  }

}
