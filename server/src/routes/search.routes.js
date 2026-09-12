const router = require('express').Router();
const { z } = require('zod');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { globalSearch } = require('../controllers/search.controller');

const searchQuery = z.object({ q: z.string().trim().max(100).optional() });

router.use(authenticate);
router.get('/', validate.query(searchQuery), globalSearch);

module.exports = router;
