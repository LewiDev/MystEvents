import { Schema, model, Document } from 'mongoose';

/**
 * Represents top‑level configuration for a Clash of the Realms event.
 *
 * This model stores runtime settings such as the number of days,
 * start date, channel and category IDs, per‑message RF values,
 * drop ranges and cooldowns, and shop pricing. These values can
 * be tuned without redeploying code and are loaded when the
 * scheduler starts. Defaults mirror the recommended values from
 * the initial specification.
 */
export interface IClashEventConfig extends Document {
  eventId: string;
  name: string;
  modeDays: number;
  startsAt: Date;
  publicDropChannelId: string;
  teamCategoryId?: string;
  stageTitles: Record<string, string>;
  rf: {
    perMessageBase: number;
    messageCooldownSec: number;
    wordlePlacings: number[];
  };
  drops: {
    claim: { min: number; max: number; cooldownSec: number };
    steal: { min: number; max: number; cooldownSec: number };
    prize: { amount: number; perUserMax: number };
  };
  shop: {
    sabotageCost: number;
    sabotageDurationSec: number;
    sabotageCooldownSec: number;
    nitroCost: number;
  };
}

const ClashEventConfigSchema = new Schema<IClashEventConfig>({
  eventId: { type: String, required: true },
  name: { type: String, required: true },
  modeDays: { type: Number, required: true },
  startsAt: { type: Date, required: true },
  publicDropChannelId: { type: String, required: true },
  teamCategoryId: { type: String },
  // Map field stores dynamic day→stage title mapping
  stageTitles: { type: Map, of: String, default: {} },
  rf: {
    perMessageBase: { type: Number, default: 1 },
    messageCooldownSec: { type: Number, default: 30 },
    wordlePlacings: { type: [Number], default: [2, 1.75, 1.5, 1.25, 1] },
  },
  drops: {
    claim: {
      min: { type: Number, default: 10 },
      max: { type: Number, default: 30 },
      cooldownSec: { type: Number, default: 600 },
    },
    steal: {
      min: { type: Number, default: 10 },
      max: { type: Number, default: 25 },
      cooldownSec: { type: Number, default: 1800 },
    },
    prize: {
      amount: { type: Number, default: 100 },
      perUserMax: { type: Number, default: 2 },
    },
  },
  shop: {
    sabotageCost: { type: Number, default: 100 },
    sabotageDurationSec: { type: Number, default: 1800 },
    sabotageCooldownSec: { type: Number, default: 3600 },
    nitroCost: { type: Number, default: 0 },
  },
});

export const ClashEventConfig = model<IClashEventConfig>('ClashEventConfig', ClashEventConfigSchema);