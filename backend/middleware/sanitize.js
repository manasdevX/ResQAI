// ─────────────────────────────────────────────────────────────────────────────
// NoSQL operator-injection guard.
//
// Strips any object key that begins with `$` (a MongoDB query/update operator)
// or contains a `.` (a dotted path) from req.body, req.params and the *values*
// inside req.query. Without this, a request like
//   GET /api/incidents?status[$ne]=resolved
// would let `{ $ne: 'resolved' }` flow straight into Mongoose `.find()`.
//
// WHY A CUSTOM MIDDLEWARE INSTEAD OF express-mongo-sanitize:
// express-mongo-sanitize@2 reassigns `req.query`, but in Express 5 `req.query`
// is a read-only getter — assigning to it throws. This implementation mutates
// objects in place and never reassigns the getter, so it is Express 5 safe.
// ─────────────────────────────────────────────────────────────────────────────

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && !Buffer.isBuffer(v);

/** Recursively delete dangerous keys from a plain object / array, mutating in place. */
const scrub = (value) => {
  if (Array.isArray(value)) {
    value.forEach(scrub);
    return;
  }
  if (!isPlainObject(value)) return;

  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete value[key];
    } else {
      scrub(value[key]);
    }
  }
};

export const sanitizeRequest = (req, _res, next) => {
  // req.body and req.params are ordinary writable objects — scrub in place.
  if (req.body)   scrub(req.body);
  if (req.params) scrub(req.params);

  // Express 5 gotcha: `req.query` is a *non-caching* getter — it re-parses the
  // query string on every access. Mutating the object returned by one read is
  // useless because the route handler re-reads a fresh, unsanitized parse.
  // Instead, parse once, scrub it, then REDEFINE req.query as a static value
  // (the getter is `configurable`, so this is allowed and is Express 5 safe).
  // NOTE: Express 5's default query parser is "simple" (Node querystring), which
  // does NOT expand bracket notation, so query values are always strings/arrays
  // and can never be operator objects. This block is belt-and-suspenders in case
  // a future maintainer switches to the "extended" (qs) parser.
  try {
    const sanitized = req.query;
    scrub(sanitized);
    Object.defineProperty(req, 'query', {
      value:        sanitized,
      writable:     true,
      configurable: true,
      enumerable:   true,
    });
  } catch {
    /* if query parsing/redefine ever fails, skip silently — never block the request */
  }

  next();
};

export default sanitizeRequest;
