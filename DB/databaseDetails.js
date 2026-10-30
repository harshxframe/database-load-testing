import { pathToFileURL } from "node:url";
import { getUsageEventDatabaseDetails } from "./read/databaseDetails.js";

const LOCAL_TEST_MONGO_URI =
  "mongodb://test:admin@127.0.0.1:27018/loadtest?authSource=admin";

export async function getDatabaseDetails({ mongoUri } = {}) {
  return getUsageEventDatabaseDetails(
    mongoUri ?? process.env.MONGO_URI ?? LOCAL_TEST_MONGO_URI,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const details = await getDatabaseDetails();
    console.dir(details, { depth: null });
  } catch (error) {
    console.error("Database details failed:", error.message);
    process.exitCode = 1;
  }
}
