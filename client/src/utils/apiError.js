import axios from 'axios';

// Turns any failed request into a sentence a person can act on. The
// server's own message wins when it exists (it's already user-facing);
// everything else maps by status/network condition.
export function getApiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (axios.isCancel?.(err) || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return null;

  const status = err.response?.status;
  const serverMessage = err.response?.data?.message;
  const code = err.response?.data?.code;

  if (!err.response) {
    if (err.code === 'ECONNABORTED') return 'The request timed out. Please check your connection and try again.';
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  if (status === 401) {
    if (code === 'ACCOUNT_LOCKED' || code === 'ACCOUNT_INACTIVE') return serverMessage;
    return serverMessage && /password|email/i.test(serverMessage) ? serverMessage : 'Your session has expired. Please sign in again.';
  }
  if (status === 403) return serverMessage || "You don't have permission to do that.";
  if (status === 404) return serverMessage || 'That record could not be found.';
  if (status === 409) return serverMessage || 'This conflicts with an existing record.';
  if (status === 413) return 'That file or request is too large.';
  if (status === 422) {
    const errors = err.response?.data?.errors;
    if (Array.isArray(errors) && errors.length) return errors[0].replace(/^[\w.]+:\s*/, '');
    return serverMessage || 'Some of the information provided is invalid.';
  }
  if (status === 429) return serverMessage || 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'The server ran into a problem. Please try again in a moment.';

  return serverMessage || fallback;
}

// Field-level validation errors from the API ("email: Enter a valid email")
// keyed by field name, for mapping onto form inputs.
export function getApiFieldErrors(err) {
  const errors = err?.response?.data?.errors;
  if (!Array.isArray(errors)) return {};
  const out = {};
  for (const item of errors) {
    const match = /^([\w.]+):\s*(.+)$/.exec(String(item));
    if (match) out[match[1]] = match[2];
  }
  return out;
}

export function isCancelledRequest(err) {
  return Boolean(err) && (axios.isCancel?.(err) || err.name === 'CanceledError' || err.code === 'ERR_CANCELED');
}
