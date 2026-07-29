const { z } = require('zod');

const addressSchema = z.object({
  line1: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  zip: z.string().optional().or(z.literal('')),
}).optional();

const baseEmployeeFields = {
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().optional().or(z.literal('')),
  dob: z.string().optional().or(z.literal('')),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  joiningDate: z.string().min(1, 'Joining date is required'),
  department: z.string().min(1, 'Department is required'),
  designation: z.string().min(1, 'Designation is required'),
  manager: z.string().optional().nullable(),
  employmentType: z.enum(['Full-Time', 'Part-Time', 'Contract', 'Intern']).optional(),
  address: addressSchema,
};

// Only used when HR creates a brand new employee — also provisions a login.
const createEmployeeSchema = z.object({
  ...baseEmployeeFields,
  role: z.enum(['EMPLOYEE', 'MANAGER', 'HR_ADMIN']).optional(),
});

const updateEmployeeSchema = z.object(baseEmployeeFields);

const updateStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

module.exports = { createEmployeeSchema, updateEmployeeSchema, updateStatusSchema };
