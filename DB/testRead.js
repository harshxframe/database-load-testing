import { getDatabaseDetails } from "./databaseDetails.js";
import { runReadTest } from "./read/readUsageTest.js";

// Edit profile values here. Each profile becomes selectable by its array index.
const testProfiles = [
  { // 0
    name: "Sanity",
    queryCount: 1_000,
    workerCount: 1,
    resultLimit: 50,
    projectPoolSize: 100,
    userPoolSize: 100,
  },
  { // 1
    name: "Light",
    queryCount: 10_000,
    workerCount: 2,
    resultLimit: 50,
    projectPoolSize: 500,
    userPoolSize: 1_000,
  },
  { // 2
    name: "Medium",
    queryCount: 50_000,
    workerCount: 4,
    resultLimit: 50,
    projectPoolSize: 1_000,
    userPoolSize: 10_000,
  },
  { // 3
    name: "Heavy",
    queryCount: 100_000,
    workerCount: 8,
    resultLimit: 100,
    projectPoolSize: 2_000,
    userPoolSize: 50_000,
  },
  { // 4
    name: "Stress",
    queryCount: 250_000,
    workerCount: 16,
    resultLimit: 100,
    projectPoolSize: 5_000,
    userPoolSize: 100_000,
  },
  { // 5
    name: "Repeatability",
    queryCount: 250_000,
    workerCount: 8,
    resultLimit: 100,
    projectPoolSize: 5_000,
    userPoolSize: 100_000,
  },
  { // 6
    name: "Concurrency A",
    queryCount: 250_000,
    workerCount: 16,
    resultLimit: 100,
    projectPoolSize: 5_000,
    userPoolSize: 100_000,
  },
  { // 7
    name: "Concurrency B",
    queryCount: 250_000,
    workerCount: 32,
    resultLimit: 100,
    projectPoolSize: 5_000,
    userPoolSize: 100_000,
  },
  { // 8
    name: "Concurrency C",
    queryCount: 250_000,
    workerCount: 64,
    resultLimit: 100,
    projectPoolSize: 5_000,
    userPoolSize: 100_000,
  },
  { // 9
    name: "Volume test",
    queryCount: 1_000_000,
    workerCount: 16,
    resultLimit: 100,
    projectPoolSize: 5_000,
    userPoolSize: 100_000,
  },
];

function getEnvNumber(name, fallback) {
  return Number(process.env[name] ?? fallback);
}

try {
  const databaseDetails = await getDatabaseDetails();
  console.log("\nDatabase details:");
  console.dir(databaseDetails, { depth: null });

  const requestedIndex = process.env.PROFILE_INDEX;
  const profileIndexes =
    requestedIndex === undefined
      ? testProfiles.map((_, index) => index)
      : [Number(requestedIndex)];

  if (
    profileIndexes.some(
      (index) => !Number.isInteger(index) || !testProfiles[index],
    )
  ) {
    throw new Error(
      `PROFILE_INDEX must be between 0 and ${testProfiles.length - 1}`,
    );
  }

  for (const profileIndex of profileIndexes) {
    const profile = testProfiles[profileIndex];
    const config = {
      ...profile,
      queryCount: getEnvNumber("QUERY_COUNT", profile.queryCount),
      workerCount: getEnvNumber("WORKER_COUNT", profile.workerCount),
      resultLimit: getEnvNumber("RESULT_LIMIT", profile.resultLimit),
      projectPoolSize: getEnvNumber(
        "PROJECT_POOL_SIZE",
        profile.projectPoolSize,
      ),
      userPoolSize: getEnvNumber("USER_POOL_SIZE", profile.userPoolSize),
    };

    try {
      const result = await runReadTest(config);
      console.log(`\nRead profile ${profileIndex}: ${profile.name}`);
      console.log({ profile: profile.name, ...result });
    } catch (error) {
      console.error(
        `Read profile ${profileIndex} (${profile.name}) failed:`,
        error.message,
      );
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error("Usage read test failed:", error.message);
  process.exitCode = 1;
}
