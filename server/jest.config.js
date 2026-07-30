module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // Integration tests spin up an in-memory MongoDB, which can take a few
  // seconds on first run while it downloads/caches the binary.
  testTimeout: 30000,
  verbose: true,
};
