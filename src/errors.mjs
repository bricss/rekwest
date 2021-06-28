export class RequestError extends Error {

  get name() {
    return this.constructor.name;
  }

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }

  constructor(message) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }

}
