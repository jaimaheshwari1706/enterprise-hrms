const { z } = require('zod');
const { optionalText, timeString, dateString } = require('./common');

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PRO_RATA_BASES = ['none', 'calendar', 'working'];

function isValidTimezone(value) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const holidaySchema = z.object({
  date: dateString('Holiday date'),
  name: z.string().trim().min(1, 'Holiday name is required').max(80),
});

const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(2, 'Organization name is required').max(120),
    email: z.string().trim().toLowerCase().email('Enter a valid email').max(254).optional().or(z.literal('')),
    phone: optionalText(30),
    address: optionalText(300),
    country: optionalText(100),
    timezone: z
      .string()
      .trim()
      .max(64)
      .refine(isValidTimezone, 'Enter a valid IANA timezone (e.g. Asia/Kolkata)')
      .optional(),
    workingDays: z.array(z.enum(WEEKDAYS)).min(1, 'Select at least one working day').max(7).optional(),
    // Whole list replaced on every save (small, and the UI edits it as a
    // list). Duplicate dates are rejected so a holiday can't be counted
    // twice by accident.
    holidays: z
      .array(holidaySchema)
      .max(200)
      .refine((list) => new Set(list.map((h) => h.date)).size === list.length, 'Each holiday date can only appear once')
      .optional(),
    officeStartTime: timeString('Office start time').optional().or(z.literal('')),
    officeEndTime: timeString('Office end time').optional().or(z.literal('')),
    payrollPolicy: z
      .object({
        proRataBasis: z.enum(PRO_RATA_BASES),
        deductUnpaidLeave: z.boolean(),
      })
      .refine((p) => !(p.deductUnpaidLeave && p.proRataBasis === 'none'), {
        message: 'Unpaid leave deduction requires a pro-rata basis (calendar or working days)',
        path: ['deductUnpaidLeave'],
      })
      .optional(),
  })
  .refine(
    (data) => !data.officeStartTime || !data.officeEndTime || data.officeStartTime < data.officeEndTime,
    { message: 'Office end time must be after the start time', path: ['officeEndTime'] }
  );

module.exports = { updateOrganizationSchema, WEEKDAYS, PRO_RATA_BASES };
