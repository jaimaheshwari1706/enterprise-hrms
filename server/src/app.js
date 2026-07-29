require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

// Simple liveness check used to confirm Phase 2 scaffolding runs correctly.
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Enterprise HRMS API is running', data: { env: env.nodeEnv } });
});

// Feature routes are mounted here as each phase builds them.
app.use('/api', require('./routes'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
