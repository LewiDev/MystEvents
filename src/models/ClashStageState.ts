import { Schema, model, Document } from 'mongoose';

/**
 * Represents per‑team, per‑day stage state. The scheduler sets
 * status to ACTIVE when the stage unlocks and transitions to
 * COMPLETE when either the time expires or the stage logic marks
 * completion. Arbitrary JSON is stored in details for
 * stage‑specific state, such as counting progress or word lists.
 */
export interface IClashStageState extends Document {
  eventId: string;
  teamNumber: number;
  day: number;
  stageKey: string;
  status: 'LOCKED' | 'ACTIVE' | 'COMPLETE';
  score: number;
  details: any;
  startedAt?: Date;
  completedAt?: Date;
}

const ClashStageStateSchema = new Schema<IClashStageState>({
  eventId: { type: String, required: true, index: true },
  teamNumber: { type: Number, required: true },
  day: { type: Number, required: true },
  stageKey: { type: String, required: true },
  status: { type: String, enum: ['LOCKED', 'ACTIVE', 'COMPLETE'], default: 'LOCKED' },
  score: { type: Number, default: 0 },
  details: { type: Schema.Types.Mixed, default: {} },
  startedAt: { type: Date },
  completedAt: { type: Date },
});

// Unique index ensures one stage record per team per day
ClashStageStateSchema.index({ eventId: 1, teamNumber: 1, day: 1 }, { unique: true });

export const ClashStageState = model<IClashStageState>('ClashStageState', ClashStageStateSchema);