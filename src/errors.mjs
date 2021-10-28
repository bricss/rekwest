export class RequestError extends Error {

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }

  get name() {
    return this[Symbol.toStringTag];
  }

  constructor(message) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }

}
