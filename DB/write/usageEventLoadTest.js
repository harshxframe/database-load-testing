import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { usageEventSchema } from "../models/UsageEvent.js";

const PROVIDERS = [
  {
    provider: "openai",
    model: "gpt-4.1-mini",
    endpoint: "/v1/chat/completions",
    inputRate: 0.0000004,
    outputRate: 0.0000016,
  },
  {
    provider: "openai",
    model: "text-embedding-3-small",
    endpoint: "/v1/embeddings",
    inputRate: 0.00000002,
    outputRate: 0,
  },
  {
    provider: "anthropic",
    model: "claude-3-5-haiku",
    endpoint: "/v1/messages",
    inputRate: 0.0000008,
    outputRate: 0.000004,
  },
  {
    provider: "ollama",
    model: "llama3.2",
    endpoint: "/v1/chat/completions",
    inputRate: 0,
    outputRate: 0,
  },
];

const STATUS_CODES = [200, 200, 200, 200, 200, 201, 400, 401, 429, 500, 503];
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const loadTestConfig = {
  mongoUri: process.env.MONGO_URI,
  recordCount: Number(process.env.RECORD_COUNT ?? 10_000),
  workerCount: Number(process.env.WORKER_COUNT ?? 8),
  batchSize: Number(process.env.BATCH_SIZE ?? 1_000),
  projectPoolSize: Number(process.env.PROJECT_POOL_SIZE ?? 100),
  userPoolSize: Number(process.env.USER_POOL_SIZE ?? 1_000),
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(items) {
  return items[randomInt(0, items.length - 1)];
}

function createPool(size, factory) {
  return Array.from({ length: size }, factory);
}

function normalizeConfig(config) {
  if (!config.mongoUri) {
    throw new Error("MONGO_URI is required");
  }

  for (const field of [
    "recordCount",
    "workerCount",
    "batchSize",
    "projectPoolSize",
    "userPoolSize",
  ]) {
    if (!Number.isInteger(config[field]) || config[field] <= 0) {
      throw new Error(`${field} must be a positive integer`);
    }
  }

  return config;
}

export function generateUsageEvents({
  recordCount,
  projectPoolSize = 100,
  userPoolSize = 1_000,
}) {
  if (!Number.isInteger(recordCount) || recordCount <= 0) {
    throw new Error("recordCount must be a positive integer");
  }

  const projectIds = createPool(
    projectPoolSize,
    () => new mongoose.Types.ObjectId(),
  );
  const userIds = createPool(
    userPoolSize,
    () => new mongoose.Types.ObjectId(),
  );
  const now = Date.now();

  return Array.from({ length: recordCount }, () => {
    const providerConfig = pickRandom(PROVIDERS);
    const statusCode = pickRandom(STATUS_CODES);
    const inputTokens = randomInt(20, 8_000);
    const outputTokens = providerConfig.outputRate === 0 ? 0 : randomInt(5, 2_000);
    const latencyMs =
      statusCode >= 500
        ? randomInt(500, 5_000)
        : statusCode === 429
          ? randomInt(5, 500)
          : randomInt(40, 2_500);

    return {
      projectId: pickRandom(projectIds),
      userId: pickRandom(userIds),
      requestId: randomUUID(),
      endpoint: providerConfig.endpoint,
      provider: providerConfig.provider,
      model: providerConfig.model,
      statusCode,
      latencyMs,
      inputTokens,
      outputTokens,
      costUsd: Number(
        (
          inputTokens * providerConfig.inputRate +
          outputTokens * providerConfig.outputRate
        ).toFixed(6),
      ),
      createdAt: new Date(now - randomInt(0, THIRTY_DAYS_MS)),
    };
  });
}

export async function saveUsageEvents(
  model,
  records,
  batchSize = 1_000,
) {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("batchSize must be a positive integer");
  }

  let insertedCount = 0;

  for (let start = 0; start < records.length; start += batchSize) {
    const batch = records.slice(start, start + batchSize);
    const inserted = await model.insertMany(batch, { ordered: false });
    insertedCount += inserted.length;
  }

  return insertedCount;
}

async function prepareCollection(mongoUri) {
  const connection = mongoose.createConnection(mongoUri, {
    serverSelectionTimeoutMS: 5_000,
  });

  try {
    await connection.asPromise();
    const UsageEvent = connection.model("UsageEvent", usageEventSchema);
    await UsageEvent.init();
  } finally {
    await connection.close();
  }
}

function splitRecords(records, workerCount) {
  const workerRecords = Array.from(
    { length: Math.min(workerCount, records.length) },
    () => [],
  );

  records.forEach((record, index) => {
    workerRecords[index % workerRecords.length].push(record);
  });

  return workerRecords;
}

async function runWorker(mongoUri, records, batchSize) {
  const connection = mongoose.createConnection(mongoUri, {
    serverSelectionTimeoutMS: 5_000,
  });

  try {
    await connection.asPromise();
    const UsageEvent = connection.model("UsageEvent", usageEventSchema);
    const startedAt = performance.now();
    const insertedCount = await saveUsageEvents(
      UsageEvent,
      records,
      batchSize,
    );

    return {
      insertedCount,
      insertMs: performance.now() - startedAt,
    };
  } finally {
    await connection.close();
  }
}

export async function runUsageEventLoadTest(overrides = {}) {
  const config = normalizeConfig({ ...loadTestConfig, ...overrides });

  const generationStartedAt = performance.now();
  const records = generateUsageEvents(config);
  const generationMs = performance.now() - generationStartedAt;

  await prepareCollection(config.mongoUri);

  const workerRecords = splitRecords(records, config.workerCount);
  const insertStartedAt = performance.now();
  const workerResults = await Promise.all(
    workerRecords.map((recordsForWorker) =>
      runWorker(config.mongoUri, recordsForWorker, config.batchSize),
    ),
  );
  const insertMs = performance.now() - insertStartedAt;
  const insertedCount = workerResults.reduce(
    (total, result) => total + result.insertedCount,
    0,
  );

  return {
    requestedCount: config.recordCount,
    insertedCount,
    workerCount: workerRecords.length,
    batchSize: config.batchSize,
    generationMs: Number(generationMs.toFixed(2)),
    insertMs: Number(insertMs.toFixed(2)),
    totalMs: Number((generationMs + insertMs).toFixed(2)),
    insertsPerSecond: Math.round((insertedCount / Math.max(insertMs, 1)) * 1_000),
  };
}
