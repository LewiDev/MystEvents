// src/models/OneKMem.ts
import mongoose, { Schema } from "mongoose";
import { createModel } from "./utils/createModel";

/** 1..10 as a type */
export type StageNumber = 1|2|3|4|5|6|7|8|9|10;
export type StageKey = `stage${StageNumber}`;

export interface StageProgress {
  hint?: string;
  hintUsed?: boolean;
  startedAt: Date;
  completedAt: Date;
}

export interface IOneKMem {
  userId: string;
  threadId: string;
  startedEvent: Date;
  completedStages: number[];
  currentStage: number;
  pendingStageEmbeds?: number[]; // Stages that need embeds sent
  stage1: StageProgress;
  stage2: StageProgress;
  stage3: StageProgress;
  stage4: StageProgress;
  stage5: StageProgress;
  stage6: StageProgress;
  stage7: StageProgress;
  stage8: StageProgress;
  stage9: StageProgress;
  stage10: StageProgress;
  bonusClaimed: boolean;
  bonusClaimedAt: Date;
  disqualified: boolean;
  dqReason?: string;
  dqDate?: Date;
  // Instance methods
  hasCompleted(stageNumber: number): boolean;
  markCompleted(stageNumber: number): void;
  markHintUsed(stageNumber: number): void;
}

/** Subschema reused for each stage */
const StageProgressSchema = new Schema<StageProgress>(
  {
    hint: { type: String },
    hintUsed: { type: Boolean, default: false },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, required: true },
  },
  { _id: false }
);

/** Build stage1..stage10 fields */
function buildStageFields(): Record<StageKey, any> {
  const fields: Partial<Record<StageKey, any>> = {};
  for (let i = 1 as StageNumber; i <= 10; i++) {
    const key = `stage${i}` as StageKey;
    fields[key] = { type: StageProgressSchema, required: true };
  }
  return fields as Record<StageKey, any>;
}

const OneKMemSchema = new Schema<IOneKMem>(
  {
    userId: { type: String, required: true, unique: true, index: true, trim: true },
    threadId: { type: String, required: true, unique: true, index: true, trim: true },

    startedEvent: { type: Date, required: true },
    completedStages: {
      type: [Number],
      default: [],
      validate: {
        validator: (arr: number[]) =>
          Array.isArray(arr) &&
          arr.every(n => Number.isInteger(n) && n >= 1 && n <= 10) &&
          new Set(arr).size === arr.length, // no duplicates
        message: "completedStages must contain unique integers between 1 and 10.",
      },
    },
    currentStage: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    pendingStageEmbeds: {
      type: [Number],
      default: [],
    },

    ...buildStageFields(),
    bonusClaimed: {
      type: Boolean,
      default: false,
    },
    bonusClaimedAt: {
      type: Date,
      default: new Date(),
    },
    disqualified: {
      type: Boolean,
      default: false,
    },
    dqReason: {
      type: String,
      default: null,
    },
    dqDate: {
      type: Date,
      default: null,
    },
  },
  {
    versionKey: false,
    timestamps: true, // createdAt / updatedAt for the document
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Safety compound index example (optional)
OneKMemSchema.index({ userId: 1, threadId: 1 }, { unique: true }); // ensures a single record per (user, thread)

// ----- Instance methods -----
OneKMemSchema.method("hasCompleted", function (this: IOneKMem, stage: StageNumber) {
  return this.completedStages.includes(stage);
});

OneKMemSchema.method("markCompleted", function (this: IOneKMem, stage: StageNumber, when?: Date) {
  const key = `stage${stage}` as StageKey;
  if (!this.completedStages.includes(stage)) {
    this.completedStages.push(stage);
  }
  // Ensure completedAt is set
  // @ts-ignore (document indexer)
  if (!this[key]) this[key] = {};
  // @ts-ignore
  this[key].completedAt = when ?? new Date();
});

OneKMemSchema.method("markHintUsed", function (this: IOneKMem, stage: StageNumber) {
  const key = `stage${stage}` as StageKey;
  // @ts-ignore
  if (!this[key]) this[key] = {};
  // @ts-ignore
  this[key].hintUsed = true;
});

export const OneKMem = createModel<IOneKMem>("OneKMem", OneKMemSchema);
