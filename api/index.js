// Lightweight Vercel wrapper: re-export the server handler so Vercel always
// sees a top-level export in the `api/` folder.
const srv = require('../server/server.js');

// Prefer common handler names that may be exported from server/server.js
const handler = srv.default || srv.handler || srv;

module.exports = handler;
