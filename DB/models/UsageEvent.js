import mongoose from "mongoose";

export const usageEventSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    requestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    endpoint: {
      type: String,
      required: true,
      trim: true,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    statusCode: {
      type: Number,
      required: true,
      min: 100,
      max: 599,
    },
    latencyMs: {
      type: Number,
      required: true,
      min: 0,
    },
    inputTokens: {
      type: Number,
      default: 0,
      min: 0,
    },
    outputTokens: {
      type: Number,
      default: 0,
      min: 0,
    },
    costUsd: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    collection: "usage_events",
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

usageEventSchema.index({ projectId: 1, createdAt: -1 });
usageEventSchema.index({ userId: 1, createdAt: -1 });

export const UsageEvent =
  mongoose.models.UsageEvent ??
  mongoose.model("UsageEvent", usageEventSchema);
