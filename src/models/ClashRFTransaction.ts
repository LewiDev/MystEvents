import { Schema, model, Document } from 'mongoose';

/**
 * Append‑only ledger of Relic Fragment (RF) balance changes.
 * Each transaction records the change, classification and optional
 * actor and target identifiers. Team rfBalance is updated in
 * conjunction with each ledger entry; use the rfLedger service to
 * mutate balances rather than writing transactions directly.
 */
export interface IClashRFTransaction extends Document {
  eventId: string;
  teamNumber: number;
  type: string;
  delta: number;
  actorId?: string;
  targetTeam?: number;
  meta?: any;
  createdAt: Date;
}

const ClashRFTransactionSchema = new Schema<IClashRFTransaction>({
  eventId: { type: String, required: true, index: true },
  teamNumber: { type: Number, required: true },
  type: { type: String, required: true },
  delta: { type: Number, required: true },
  actorId: { type: String },
  targetTeam: { type: Number },
  meta: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

export const ClashRFTransaction = model<IClashRFTransaction>('ClashRFTransaction', ClashRFTransactionSchema);