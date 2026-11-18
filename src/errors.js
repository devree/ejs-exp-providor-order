'use strict';

class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.code = 'NOT_FOUND';
    this.status = 404;
  }
}

module.exports = { NotFoundError };
