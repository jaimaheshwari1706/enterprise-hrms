const { z } = require('zod');
const { objectId, dateString, pageQuery, sortQuery } = require('./common');

const LEAVE_STATUSES = ['Pending', 'Approved', 'Rejected', 'Cancelled'];

const applyLeaveSchema = z
  .object({
    leaveType: objectId('Leave type'),
    startDate: dateString('Start date'),
    endDate: dateString('End date'),
    reason: z.string().trim().min(3, 'Please provide a reason (at least 3 characters)').max(500),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date cannot be before start date',
    path: ['endDate'],
  });

const previewLeaveQuery = z
  .object({
    startDate: dateString('startDate'),
    endDate: dateString('endDate'),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'endDate cannot be before startDate',
    path: ['endDate'],
  });

const decisionSchema = z.object({
  comment: z.string().trim().max(500).optional().or(z.literal('')),
});

const leaveTypeFields = {
  name: z.string().trim().min(2, 'Name is required').max(60),
  defaultDaysPerYear: z.number().int('Days must be a whole number').min(0).max(366),
  description: z.string().trim().max(300).optional().or(z.literal('')),
  isPaid: z.boolean().optional(),
};
const createLeaveTypeSchema = z.object(leaveTypeFields);
const updateLeaveTypeSchema = z
  .object({
    name: leaveTypeFields.name.optional(),
    defaultDaysPerYear: leaveTypeFields.defaultDaysPerYear.optional(),
    description: leaveTypeFields.description,
    isPaid: leaveTypeFields.isPaid,
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

const LEAVE_SORT_FIELDS = ['createdAt', 'startDate', 'endDate', 'days', 'status'];

const listLeavesQuery = z.object({
  ...pageQuery,
  sort: sortQuery(LEAVE_SORT_FIELDS),
  status: z.enum(LEAVE_STATUSES).optional().or(z.literal('')),
  employee: objectId('employee').optional().or(z.literal('')),
  from: dateString('from').optional().or(z.literal('')),
  to: dateString('to').optional().or(z.literal('')),
});

const myLeavesQuery = z.object({
  ...pageQuery,
  sort: sortQuery(LEAVE_SORT_FIELDS),
  status: z.enum(LEAVE_STATUSES).optional().or(z.literal('')),
});

module.exports = {
  applyLeaveSchema,
  previewLeaveQuery,
  decisionSchema,
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  listLeavesQuery,
  myLeavesQuery,
  LEAVE_SORT_FIELDS,
  LEAVE_STATUSES,
};
