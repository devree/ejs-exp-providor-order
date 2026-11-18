'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const requestLog = require('./middleware/requestLog');

const app = express();

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(requestLog);
app.use(express.static(path.join(__dirname, 'public')));

// API routers (admin router has its own JSON parser; no global body parser here).
app.use('/api/admin', require('./routes/admin.api'));
app.use('/api/pull', require('./routes/pull.api'));

// Page routes are added by a later task; only mount when present.
if (fs.existsSync(path.join(__dirname, 'routes', 'pages.js'))) {
  app.use(require('./routes/pages'));
}

function isApi(req) {
  return req.path === '/api' || req.path.startsWith('/api/');
}

function renderError(req, res, status, message) {
  const viewFile = path.join(app.get('views'), 'error.ejs');
  if (!fs.existsSync(viewFile)) {
    return res.status(status).type('text/plain').send(message);
  }
  return res.status(status).render('error', { status, message }, (err, html) => {
    if (err) {
      console.error('[app] error view failed:', err.stack || err);
      return res.status(status).type('text/plain').send(message);
    }
    return res.send(html);
  });
}

// 404 catch-all
app.use((req, res) => {
  if (isApi(req)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  }
  return renderError(req, res, 404, 'Not found');
});

// Final error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  if (err && err.name === 'ValidationError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = err.message;
  } else if (err && err.name === 'NotFoundError') {
    status = 404;
    code = 'NOT_FOUND';
    message = err.message;
  } else {
    console.error('[app] unexpected error:', err && err.stack ? err.stack : err);
  }
  if (isApi(req)) {
    return res.status(status).json({ error: { code, message } });
  }
  return renderError(req, res, status, message);
});

module.exports = app;
