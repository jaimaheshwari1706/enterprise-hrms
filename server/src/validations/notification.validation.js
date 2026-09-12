const { z } = require('zod');
const { pageQuery } = require('./common');

const listNotificationsQuery = z.object({
  ...pageQuery,
  unreadOnly: z.enum(['true', 'false']).optional(),
});

module.exports = { listNotificationsQuery };
