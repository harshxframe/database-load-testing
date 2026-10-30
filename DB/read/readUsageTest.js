import { runUsageEventReadTest } from "./usageEventReadTest.js";

const LOCAL_TEST_MONGO_URI =
  "mongodb://test:admin@127.0.0.1:27018/loadtest?authSource=admin";

/**
 * Runs concurrent, indexed reads against seeded usage events.
 *
 * @param {object} options
 * @param {string} [options.mongoUri] MongoDB URI. Defaults to MONGO_URI or the local test container.
 * @param {number} [options.queryCount] Total number of read queries.
 * @param {number} [options.workerCount] Number of independent MongoDB connections.
 * @param {number} [options.resultLimit] Maximum documents returned per query.
 * @param {number} [options.projectPoolSize] Number of project IDs sampled for reads.
 * @param {number} [options.userPoolSize] Number of user IDs sampled for reads.
 */
export async function runReadTest({
  mongoUri,
  queryCount = 10_000,
  workerCount = 4,
  resultLimit = 50,
  projectPoolSize = 1_000,
  userPoolSize = 10_000,
} = {}) {
  return runUsageEventReadTest({
    mongoUri: mongoUri ?? process.env.MONGO_URI ?? LOCAL_TEST_MONGO_URI,
    queryCount,
    workerCount,
    resultLimit,
    projectPoolSize,
    userPoolSize,
  });
}
