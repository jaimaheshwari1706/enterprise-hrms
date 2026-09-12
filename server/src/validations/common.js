const { z } = require('zod');

// Reusable Zod building blocks shared by every validation file so the same
// rules (what an id looks like, how dates are written, pagination limits)
// are enforced identically across the API.

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const objectId = (label = 'id') => z.string().regex(OBJECT_ID_RE, `${label} must be a valid id`);

// Accepts "YYYY-MM-DD" and checks it is a real calendar date (rejects
// 2026-02-30). Kept as a string so controllers decide how to interpret it.
const dateString = (label = 'Date') =>
  z
    .string()
    .regex(DATE_RE, `${label} must be in YYYY-MM-DD format`)
    .refine((value) => {
      const d = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
    }, `${label} is not a valid calendar date`);

const monthString = (label = 'Month') => z.string().regex(MONTH_RE, `${label} must be in YYYY-MM format`);
const timeString = (label = 'Time') => z.string().regex(TIME_RE, `${label} must be in HH:MM format`);

// Optional free-text field that treats "" as "not provided".
const optionalText = (max = 200) => z.string().trim().max(max).optional().or(z.literal(''));

// Pagination + sorting as query params. `sort` is a whitelist per endpoint,
// written as "field" (asc) or "-field" (desc), e.g. ?sort=-createdAt.
const pageQuery = {
  page: z.coerce.number().int().min(1).max(100000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

function sortQuery(allowedFields) {
  const allowed = new Set(allowedFields.flatMap((f) => [f, `-${f}`]));
  return z
    .string()
    .refine((value) => allowed.has(value), `sort must be one of: ${[...allowed].join(', ')}`)
    .optional();
}

const searchQuery = z.string().trim().max(100).optional();

// Passwords: enforced for *new* passwords only (reset, change, provisioning).
// The login schema deliberately stays lenient so accounts created under the
// older 6-character rule can still sign in and then be nudged to update.
const strongPassword = (label = 'Password') =>
  z
    .string()
    .min(8, `${label} must be at least 8 characters`)
    .max(128, `${label} must be at most 128 characters`)
    .regex(/[A-Za-z]/, `${label} must contain at least one letter`)
    .regex(/\d/, `${label} must contain at least one number`);

module.exports = {
  OBJECT_ID_RE,
  objectId,
  dateString,
  monthString,
  timeString,
  optionalText,
  pageQuery,
  sortQuery,
  searchQuery,
  strongPassword,
  idParam: z.object({ id: objectId('id') }),
};
