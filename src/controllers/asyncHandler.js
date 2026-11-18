'use strict';

/** Wrap an async express handler so rejections are forwarded to next(err). */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
