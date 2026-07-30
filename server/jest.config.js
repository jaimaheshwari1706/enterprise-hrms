module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // Integration tests spin up an in-memory MongoDB, which can take a few
  // seconds on first run while it downloads/caches the binary.
  testTimeout: 30000,
  verbose: true,
  // Integration suites each start their own in-memory mongod. Running them
  // in parallel workers (Jest's default) launches several mongod processes
  // at once, which was blowing past mongodb-memory-server's own startup
  // timeout under the resulting resource contention. One worker at a time
  // keeps instance startup reliable at a modest cost to wall-clock time.
  maxWorkers: 1,
};
