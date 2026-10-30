import mongoose from "mongoose";
import { usageEventSchema } from "../models/UsageEvent.js";

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];

function formatBytes(bytes = 0) {
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1_024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1_024;
    unitIndex += 1;
  }

  return `${value.toFixed(2)} ${BYTE_UNITS[unitIndex]}`;
}

function formatIndexKeys(keys) {
  return Object.entries(keys)
    .map(([field, direction]) => `${field}:${direction}`)
    .join(", ");
}

export async function getUsageEventDatabaseDetails(mongoUri) {
  if (!mongoUri) {
    throw new Error("MONGO_URI is required");
  }

  const connection = mongoose.createConnection(mongoUri, {
    serverSelectionTimeoutMS: 5_000,
  });

  try {
    await connection.asPromise();
    const UsageEvent = connection.model("UsageEvent", usageEventSchema);
    await UsageEvent.init();

    const collection = connection.collection("usage_events");
    const [databaseStats, collectionStats, indexes] = await Promise.all([
      connection.db.command({ dbStats: 1, scale: 1 }),
      connection.db.command({ collStats: "usage_events" }),
      collection.indexes(),
    ]);
    const indexSizes = collectionStats.indexSizes ?? {};

    return {
      database: {
        name: databaseStats.db,
        collections: databaseStats.collections,
        objects: databaseStats.objects,
        dataSizeBytes: databaseStats.dataSize,
        dataSize: formatBytes(databaseStats.dataSize),
        storageSizeBytes: databaseStats.storageSize,
        storageSize: formatBytes(databaseStats.storageSize),
        indexSizeBytes: databaseStats.indexSize,
        indexSize: formatBytes(databaseStats.indexSize),
        totalSizeBytes: databaseStats.totalSize,
        totalSize: formatBytes(databaseStats.totalSize),
      },
      collection: {
        name: "usage_events",
        documentCount: collectionStats.count,
        dataSizeBytes: collectionStats.size,
        dataSize: formatBytes(collectionStats.size),
        storageSizeBytes: collectionStats.storageSize,
        storageSize: formatBytes(collectionStats.storageSize),
        indexSizeBytes: collectionStats.totalIndexSize,
        indexSize: formatBytes(collectionStats.totalIndexSize),
        totalSizeBytes: collectionStats.totalSize,
        totalSize: formatBytes(collectionStats.totalSize),
        indexCount: collectionStats.nindexes,
      },
      indexes: indexes.map((index) => ({
        name: index.name,
        keys: formatIndexKeys(index.key),
        unique: index.unique === true,
        sizeBytes: indexSizes[index.name] ?? 0,
        size: formatBytes(indexSizes[index.name] ?? 0),
      })),
    };
  } finally {
    await connection.close();
  }
}
