import { runUsageTest } from "./write/usageTest.js";

// Edit profile values here. Each profile becomes selectable by its array index.
const testProfiles = [
  { // 0
    name: "Sanity",
    recordCount: 1_000,
    workerCount: 1,
    batchSize: 100,
    projectPoolSize: 100,
    userPoolSize: 100,
  },
  { // 1
    name: "Light",
    recordCount: 10_000,
    workerCount: 2,
    batchSize: 500,
    projectPoolSize: 500,
    userPoolSize: 1_000,
  },
  { // 2
    name: "Medium",
    recordCount: 50_000,
    workerCount: 4,
    batchSize: 1_000,
    projectPoolSize: 1_000,
    userPoolSize: 10_000,
  },
  { // 3
    name: "Heavy",
    recordCount: 100_000,
    workerCount: 8,
    batchSize: 1_000,
    projectPoolSize: 2_000,
    userPoolSize: 50_000,
  },
  { // 4
    name: "Stress",
    recordCount: 250_000,
    workerCount: 16,
    batchSize: 1_000,
    projectPoolSize: 5_000,
    userPoolSize: 100_000,
  },
  { // 5
    name: "Repeatability",
    recordCount: 250_000,
    workerCount: 8,
    batchSize: 1_000,
    projectPoolSize: 5_000,
    userPoolSize: 100_000,
  },
  { // 6
    name: "Concurrency A",
    recordCount: 250_000,
    workerCount: 16,
    batchSize: 1_000,
    projectPoolSize: 5_000,
    userPoolSize: 100_000,
  },
  { // 7
    name: "Concurrency B",
    recordCount: 250_000,
    workerCount: 32,
    batchSize: 1_000,
    projectPoolSize: 5_000,
    userPoolSize: 100_000,
  },
  { // 8
    name: "Concurrency C",
    recordCount: 250_000,
    workerCount: 64,
    batchSize: 1_000,
    projectPoolSize: 5_000,
    userPoolSize: 100_000,
  },
  { // 9
    name: "Volume test",
    recordCount: 1_000_000,
    workerCount: 16,
    batchSize: 1_000,
    projectPoolSize: 5_000,
    userPoolSize: 100_000,
  },
];

function getEnvNumber(name, fallback) {
  return Number(process.env[name] ?? fallback);
}

try {
  // Change the default here, or run with PROFILE_INDEX=0 through 9.
  const profileIndex = Number(process.env.PROFILE_INDEX ?? 9);
  const profile = testProfiles[profileIndex];

  if (!Number.isInteger(profileIndex) || !profile) {
    throw new Error(
      `PROFILE_INDEX must be between 0 and ${testProfiles.length - 1}`,
    );
  }

  const config = {
    ...profile,
    recordCount: getEnvNumber("RECORD_COUNT", profile.recordCount),
    workerCount: getEnvNumber("WORKER_COUNT", profile.workerCount),
    batchSize: getEnvNumber("BATCH_SIZE", profile.batchSize),
    projectPoolSize: getEnvNumber(
      "PROJECT_POOL_SIZE",
      profile.projectPoolSize,
    ),
    userPoolSize: getEnvNumber("USER_POOL_SIZE", profile.userPoolSize),
  };

  const result = await runUsageTest(config);
  console.log({ profile: profile.name, ...result });
} catch (error) {
  console.error("Usage load test failed:", error.message);
  process.exitCode = 1;
}
