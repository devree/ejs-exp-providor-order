'use strict';

function send(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

/** Admin API error handler: always responds `{ error: { code, message } }`. */
// eslint-disable-next-line no-unused-vars
function adminErrorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err && err.name === 'ValidationError') {
    return send(res, 400, 'VALIDATION_ERROR', err.message);
  }
  if (err && err.name === 'NotFoundError') {
    return send(res, 404, 'NOT_FOUND', err.message);
  }
  if (err && (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400))) {
    return send(res, 400, 'VALIDATION_ERROR', 'Malformed JSON body');
  }
  if (err && err.type === 'entity.too.large') {
    return send(res, 400, 'VALIDATION_ERROR', 'Request body too large');
  }

  console.error('[admin-api] unexpected error:', err && err.stack ? err.stack : err);
  return send(res, 500, 'INTERNAL_ERROR', 'Internal server error');
}

/** Pull API error handler: responds `{ error: 'BAD_REQUEST' | 'NOT_FOUND' | 'INTERNAL_ERROR', message }`. */
// eslint-disable-next-line no-unused-vars
function pullErrorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err && err.name === 'ValidationError') {
    return res.status(400).json({ error: 'BAD_REQUEST', message: err.message });
  }
  if (err && err.name === 'NotFoundError') {
    return res.status(404).json({ error: 'NOT_FOUND', message: err.message });
  }
  console.error('[pull-api] unexpected error:', err && err.stack ? err.stack : err);
  return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
}

module.exports = { adminErrorHandler, pullErrorHandler };
