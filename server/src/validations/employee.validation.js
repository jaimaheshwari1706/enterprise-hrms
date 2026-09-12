const { z } = require('zod');
const { objectId, dateString, optionalText, pageQuery, sortQuery, searchQuery } = require('./common');

const addressSchema = z
  .object({
    line1: optionalText(200),
    city: optionalText(100),
    state: optionalText(100),
    country: optionalText(100),
    zip: optionalText(20),
  })
  .optional();

const baseEmployeeFields = {
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  phone: optionalText(30),
  dob: dateString('Date of birth').optional().or(z.literal('')),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  joiningDate: dateString('Joining date'),
  department: objectId('Department'),
  designation: objectId('Designation'),
  manager: objectId('Manager').optional().nullable().or(z.literal('')),
  employmentType: z.enum(['Full-Time', 'Part-Time', 'Contract', 'Intern']).optional(),
  address: addressSchema,
};

// Only used when HR creates a brand new employee — also provisions a login.
const createEmployeeSchema = z.object({
  ...baseEmployeeFields,
  role: z.enum(['EMPLOYEE', 'MANAGER', 'HR_ADMIN']).optional(),
});

const updateEmployeeSchema = z
  .object({
    ...baseEmployeeFields,
    exitDate: dateString('Exit date').optional().nullable().or(z.literal('')),
  })
  .refine((data) => !data.exitDate || data.exitDate >= data.joiningDate, {
    message: 'Exit date cannot be before the joining date',
    path: ['exitDate'],
  });

const updateStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
  // Last working day when deactivating; defaults to today.
  exitDate: dateString('Exit date').optional().or(z.literal('')),
});

const EMPLOYEE_SORT_FIELDS = ['createdAt', 'firstName', 'lastName', 'employeeId', 'joiningDate', 'status'];

const listEmployeesQuery = z.object({
  ...pageQuery,
  sort: sortQuery(EMPLOYEE_SORT_FIELDS),
  search: searchQuery,
  department: objectId('department').optional().or(z.literal('')),
  designation: objectId('designation').optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']).optional().or(z.literal('')),
  employmentType: z.enum(['Full-Time', 'Part-Time', 'Contract', 'Intern']).optional().or(z.literal('')),
});

const quickSearchQuery = z.object({
  q: z.string().trim().max(100).optional(),
});

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateStatusSchema,
  listEmployeesQuery,
  quickSearchQuery,
  EMPLOYEE_SORT_FIELDS,
};
