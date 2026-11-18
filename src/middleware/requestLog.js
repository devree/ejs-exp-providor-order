'use strict';

/** Logs one line per request to stdout: `METHOD path status Nms`. */
function requestLog(req, res, next) {
  const start = process.hrtime.bigint();
  const path = req.originalUrl.split('?')[0];
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`${req.method} ${path} ${res.statusCode} ${Math.round(ms)}ms`);
  });
  next();
}

module.exports = requestLog;
