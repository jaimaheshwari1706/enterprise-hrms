const { z } = require('zod');
const { dateString, optionalText, strongPassword } = require('./common');

// Employees may only update personal/contact fields themselves — job
// fields (department, designation, manager, salary) stay HR-controlled,
// per Module 14 ("HR should control job-related fields").
const updateProfileSchema = z.object({
  phone: optionalText(30),
  dob: dateString('Date of birth').optional().or(z.literal('')),
  address: z
    .object({
      line1: optionalText(200),
      city: optionalText(100),
      state: optionalText(100),
      country: optionalText(100),
      zip: optionalText(20),
    })
    .optional(),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: strongPassword('New password'),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

module.exports = { updateProfileSchema, changePasswordSchema };
