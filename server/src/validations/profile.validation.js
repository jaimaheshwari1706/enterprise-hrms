const { z } = require('zod');

// Employees may only update personal/contact fields themselves — job
// fields (department, designation, manager, salary) stay HR-controlled,
// per Module 14 ("HR should control job-related fields").
const updateProfileSchema = z.object({
  phone: z.string().optional().or(z.literal('')),
  dob: z.string().optional().or(z.literal('')),
  address: z
    .object({
      line1: z.string().optional().or(z.literal('')),
      city: z.string().optional().or(z.literal('')),
      state: z.string().optional().or(z.literal('')),
      country: z.string().optional().or(z.literal('')),
      zip: z.string().optional().or(z.literal('')),
    })
    .optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

module.exports = { updateProfileSchema, changePasswordSchema };
