import { Schema, model, Document } from 'mongoose';

/**
 * Represents a team participating in a Clash of the Realms event.
 * Each team has a unique number within an event, a name, and
 * associated Discord channel/thread identifiers. The RF balance
 * tracks total earned RF (minus spends) across the entire event.
 */
export interface IClashTeam extends Document {
  eventId: string;
  teamNumber: number;
  name: string;
  channelId: string;
  threadByDay: Record<string, string>;
  memberIds: string[];
  captainId: string;
  captainHistory: { userId: string; from: Date; to?: Date }[];
  rfBalance: number;
  rfBlocked: number;
  createdAt: Date;
  updatedAt: Date;
}

const ClashTeamSchema = new Schema<IClashTeam>({
  eventId: { type: String, required: true, index: true },
  teamNumber: { type: Number, required: true },
  name: { type: String, required: true },
  channelId: { type: String, required: true },
  threadByDay: { type: Map, of: String, default: {} },
  memberIds: { type: [String], default: [] },
  captainId: { type: String, required: true },
  captainHistory: {
    type: [
      {
        userId: { type: String, required: true },
        from: { type: Date, required: true },
        to: { type: Date },
      },
    ],
    default: [],
  },
  rfBalance: { type: Number, default: 0 },
  rfBlocked: { type: Number, default: 0 },
}, { timestamps: true });

ClashTeamSchema.index({ eventId: 1, teamNumber: 1 }, { unique: true });

export const ClashTeam = model<IClashTeam>('ClashTeam', ClashTeamSchema);