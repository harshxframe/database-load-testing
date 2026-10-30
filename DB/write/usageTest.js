import { runUsageEventLoadTest } from "./usageEventLoadTest.js";

const LOCAL_TEST_MONGO_URI =
  "mongodb://test:admin@127.0.0.1:27018/loadtest?authSource=admin";

/**
 * Generates random usage events and writes them through parallel MongoDB workers.
 *
 * @param {object} options
 * @param {string} [options.mongoUri] MongoDB URI. Defaults to MONGO_URI or the local test container.
 * @param {number} [options.recordCount] Number of records to generate.
 * @param {number} [options.workerCount] Number of independent MongoDB connections.
 * @param {number} [options.batchSize] Records sent per bulk insert.
 * @param {number} [options.projectPoolSize] Number of reusable project IDs.
 * @param {number} [options.userPoolSize] Number of reusable user IDs.
 */
export async function runUsageTest({
  mongoUri,
  recordCount = 10_000,
  workerCount = 8,
  batchSize = 1_000,
  projectPoolSize = 100,
  userPoolSize = 1_000,
} = {}) {
  return runUsageEventLoadTest({
    mongoUri: mongoUri ?? process.env.MONGO_URI ?? LOCAL_TEST_MONGO_URI,
    recordCount,
    workerCount,
    batchSize,
    projectPoolSize,
    userPoolSize,
  });
}
