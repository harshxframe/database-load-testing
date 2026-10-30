import mongoose from "mongoose";
import { usageEventSchema } from "../models/UsageEvent.js";

const QUERY_WINDOW_DAYS = 30;
const PROJECT_QUERY_RATIO = 0.7;

export const readTestConfig = {
  mongoUri: process.env.MONGO_URI,
  queryCount: Number(process.env.QUERY_COUNT ?? 10_000),
  workerCount: Number(process.env.WORKER_COUNT ?? 4),
  resultLimit: Number(process.env.RESULT_LIMIT ?? 50),
  projectPoolSize: Number(process.env.PROJECT_POOL_SIZE ?? 1_000),
  userPoolSize: Number(process.env.USER_POOL_SIZE ?? 10_000),
};

function normalizeConfig(config) {
  if (!config.mongoUri) {
    throw new Error("MONGO_URI is required");
  }

  for (const field of [
    "queryCount",
    "workerCount",
    "resultLimit",
    "projectPoolSize",
    "userPoolSize",
  ]) {
    if (!Number.isInteger(config[field]) || config[field] <= 0) {
      throw new Error(`${field} must be a positive integer`);
    }
  }

  return config;
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function percentile(sortedValues, ratio) {
  const index = Math.ceil(sortedValues.length * ratio) - 1;
  return sortedValues[Math.max(0, index)];
}

function summarizeLatency(latencies) {
  const sorted = [...latencies].sort((left, right) => left - right);
  const total = sorted.reduce((sum, latency) => sum + latency, 0);

  return {
    average: Number((total / sorted.length).toFixed(2)),
    p50: Number(percentile(sorted, 0.5).toFixed(2)),
    p95: Number(percentile(sorted, 0.95).toFixed(2)),
    p99: Number(percentile(sorted, 0.99).toFixed(2)),
  };
}

async function sampleIds(connection, field, size) {
  const documents = await connection
    .collection("usage_events")
    .aggregate([
      { $sample: { size } },
      { $match: { [field]: { $exists: true } } },
      { $project: { _id: 0, value: `$${field}` } },
    ])
    .toArray();

  return [...new Set(documents.map((document) => String(document.value)))].map(
    (value) => new mongoose.Types.ObjectId(value),
  );
}

async function prepareReadTest(config) {
  const connection = mongoose.createConnection(config.mongoUri, {
    serverSelectionTimeoutMS: 5_000,
  });

  try {
    await connection.asPromise();
    const UsageEvent = connection.model("UsageEvent", usageEventSchema);
    await UsageEvent.init();

    const documentCount = await connection
      .collection("usage_events")
      .estimatedDocumentCount();

    if (documentCount === 0) {
      throw new Error("usage_events is empty; run the write test first");
    }

    const [projectIds, userIds] = await Promise.all([
      sampleIds(connection, "projectId", config.projectPoolSize),
      sampleIds(connection, "userId", config.userPoolSize),
    ]);

    if (projectIds.length === 0 || userIds.length === 0) {
      throw new Error("Could not sample project or user IDs");
    }

    return {
      documentCount,
      projectIds,
      userIds,
    };
  } finally {
    await connection.close();
  }
}

function splitQueryCount(queryCount, workerCount) {
  const counts = Array.from(
    { length: Math.min(queryCount, workerCount) },
    () => 0,
  );

  for (let index = 0; index < queryCount; index += 1) {
    counts[index % counts.length] += 1;
  }

  return counts;
}

async function runWorker(config, queryCount, projectIds, userIds) {
  const connection = mongoose.createConnection(config.mongoUri, {
    serverSelectionTimeoutMS: 5_000,
  });

  try {
    await connection.asPromise();
    const UsageEvent = connection.model("UsageEvent", usageEventSchema);
    const latencies = [];
    const errorMessages = [];
    const cutoff = new Date(
      Date.now() - QUERY_WINDOW_DAYS * 24 * 60 * 60 * 1_000,
    );
    let errorCount = 0;
    let returnedDocumentCount = 0;

    for (let index = 0; index < queryCount; index += 1) {
      const filter =
        Math.random() < PROJECT_QUERY_RATIO
          ? { projectId: pickRandom(projectIds), createdAt: { $gte: cutoff } }
          : { userId: pickRandom(userIds), createdAt: { $gte: cutoff } };
      const startedAt = performance.now();

      try {
        const documents = await UsageEvent.find(filter)
          .select({
            _id: 1,
            requestId: 1,
            statusCode: 1,
            latencyMs: 1,
            createdAt: 1,
          })
          .sort({ createdAt: -1 })
          .limit(config.resultLimit)
          .lean()
          .exec();

        returnedDocumentCount += documents.length;
      } catch (error) {
        errorCount += 1;

        if (errorMessages.length < 5) {
          errorMessages.push(error.message);
        }
      }

      latencies.push(performance.now() - startedAt);
    }

    return {
      latencies,
      returnedDocumentCount,
      errorCount,
      errorMessages,
    };
  } finally {
    await connection.close();
  }
}

export async function runUsageEventReadTest(overrides = {}) {
  const config = normalizeConfig({ ...readTestConfig, ...overrides });

  const setupStartedAt = performance.now();
  const { documentCount, projectIds, userIds } =
    await prepareReadTest(config);
  const setupMs = performance.now() - setupStartedAt;
  const queryCounts = splitQueryCount(config.queryCount, config.workerCount);

  const readStartedAt = performance.now();
  const workerResults = await Promise.all(
    queryCounts.map((queryCount) =>
      runWorker(config, queryCount, projectIds, userIds),
    ),
  );
  const readMs = performance.now() - readStartedAt;

  const latencies = workerResults.flatMap((result) => result.latencies);
  const returnedDocumentCount = workerResults.reduce(
    (total, result) => total + result.returnedDocumentCount,
    0,
  );
  const errorCount = workerResults.reduce(
    (total, result) => total + result.errorCount,
    0,
  );
  const errorMessages = [
    ...new Set(workerResults.flatMap((result) => result.errorMessages)),
  ];

  return {
    queryCount: config.queryCount,
    completedCount: latencies.length,
    workerCount: queryCounts.length,
    resultLimit: config.resultLimit,
    projectPoolSize: projectIds.length,
    userPoolSize: userIds.length,
    documentCount,
    setupMs: Number(setupMs.toFixed(2)),
    readMs: Number(readMs.toFixed(2)),
    queriesPerSecond: Math.round(
      (latencies.length / Math.max(readMs, 1)) * 1_000,
    ),
    returnedDocuments: returnedDocumentCount,
    averageReturnedDocuments: Number(
      (returnedDocumentCount / Math.max(latencies.length, 1)).toFixed(2),
    ),
    errorCount,
    errorMessages,
    latencyMs: summarizeLatency(latencies),
  };
}
