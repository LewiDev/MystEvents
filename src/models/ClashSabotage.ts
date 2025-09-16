import { Schema, model, Document } from 'mongoose';

/**
 * Represents an active sabotage applied by one team to another.
 * When active, the target team suffers a delay on the next event
 * command they attempt to execute. The scheduler or command
 * handlers should consult this collection and enforce the delay.
 */
export interface IClashSabotage extends Document {
  eventId: string;
  fromTeam: number;
  toTeam: number;
  activeUntil: Date;
  createdAt: Date;
}

const ClashSabotageSchema = new Schema<IClashSabotage>({
  eventId: { type: String, required: true },
  fromTeam: { type: Number, required: true },
  toTeam: { type: Number, required: true },
  activeUntil: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

ClashSabotageSchema.index({ eventId: 1, toTeam: 1, activeUntil: 1 });

export const ClashSabotage = model<IClashSabotage>('ClashSabotage', ClashSabotageSchema);