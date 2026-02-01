export class RequestError extends Error {

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }

  get name() {
    return this[Symbol.toStringTag];
  }

  constructor(...args) {
    super(...args);
    Error.captureStackTrace(this, this.constructor);
  }

}

export class TimeoutError extends RequestError {}
