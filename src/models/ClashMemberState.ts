import { Schema, model, Document } from 'mongoose';

/**
 * Tracks per‑member state for a Clash of the Realms event.
 * Holds message counts for the Message Boost award, a list of days
 * on which the team started a stage (for preventing multiple
 * startstage invocations by the same user), and arbitrary cooldowns
 * keyed by strings.
 */
export interface IClashMemberState extends Document {
  eventId: string;
  teamNumber: number;
  userId: string;
  messageCount: number;
  perDayStarted: number[];
  cooldowns: { key: string; until: Date }[];
}

const ClashMemberStateSchema = new Schema<IClashMemberState>({
  eventId: { type: String, required: true, index: true },
  teamNumber: { type: Number, required: true },
  userId: { type: String, required: true },
  messageCount: { type: Number, default: 0 },
  perDayStarted: { type: [Number], default: [] },
  cooldowns: {
    type: [
      {
        key: { type: String, required: true },
        until: { type: Date, required: true },
      },
    ],
    default: [],
  },
});

// Ensure each user has only one state per event and team
ClashMemberStateSchema.index({ eventId: 1, teamNumber: 1, userId: 1 }, { unique: true });

export const ClashMemberState = model<IClashMemberState>('ClashMemberState', ClashMemberStateSchema);