const { z } = require('zod');
const { objectId, dateString, pageQuery, sortQuery } = require('./common');

const ATTENDANCE_STATUSES = ['Present', 'Absent', 'HalfDay', 'Leave'];
const ATTENDANCE_SORT_FIELDS = ['date', 'workingHours', 'status'];

const dateRange = {
  from: dateString('from').optional().or(z.literal('')),
  to: dateString('to').optional().or(z.literal('')),
};

const listAttendanceQuery = z.object({
  ...pageQuery,
  sort: sortQuery(ATTENDANCE_SORT_FIELDS),
  employee: objectId('employee').optional().or(z.literal('')),
  status: z.enum(ATTENDANCE_STATUSES).optional().or(z.literal('')),
  ...dateRange,
});

const myHistoryQuery = z.object({
  ...pageQuery,
  sort: sortQuery(ATTENDANCE_SORT_FIELDS),
  status: z.enum(ATTENDANCE_STATUSES).optional().or(z.literal('')),
  ...dateRange,
});

module.exports = { listAttendanceQuery, myHistoryQuery, ATTENDANCE_STATUSES, ATTENDANCE_SORT_FIELDS };
