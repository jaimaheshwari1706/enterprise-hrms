// Minimal structured logger — no external dependency. In production every
// line is a single JSON object (easy to ship to Render logs / any
// aggregator); in development it's a readable prefixed line. Never pass
// tokens, passwords, or secrets into the meta object.
const env = require('../config/env');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel = LEVELS[env.logLevel] || LEVELS.info;

function serializeError(err) {
  if (!err) return undefined;
  if (!(err instanceof Error)) return err;
  return {
    name: err.name,
    message: err.message,
    code: err.code,
    ...(env.isProduction ? {} : { stack: err.stack }),
  };
}

function write(level, message, meta = {}) {
  if (LEVELS[level] < minLevel) return;

  const payload = { level, time: new Date().toISOString(), message, ...meta };
  if (payload.error) payload.error = serializeError(payload.error);

  let line;
  if (env.isProduction) {
    line = JSON.stringify(payload);
  } else {
    const { level: _l, time: _t, message: _m, ...rest } = payload;
    line = `[${level}] ${message}${Object.keys(rest).length ? ' ' + JSON.stringify(rest) : ''}`;
  }

  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

const logger = {
  debug: (message, meta) => write('debug', message, meta),
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};

module.exports = logger;
