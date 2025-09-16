// src/models/tournament.ts
import mongoose, { Schema, Types } from "mongoose";

export type TournamentStatus = "DRAFT" | "REG_OPEN" | "LOCKED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type SeedingMethod = "FIRST_COME" | "RANDOM" | "MANUAL";

export interface ITournament {
  name: string;
  status: TournamentStatus;
  seedingMethod: SeedingMethod;
  bracketSize?: number; // e.g. 8/16/32 (optional; if omitted, compute from team count power-of-two)
  maxTeams?: number;    // optional hard cap
  registrationOpensAt?: Date;
  registrationClosesAt?: Date; // after this, seeds lock & round 1 can be generated
  startedAt?: Date;
  completedAt?: Date;

  // Counters / denormalized for quick UI
  teamCount: number;
  waitlistCount: number;

  // Admin notes
  notes?: string;
}

const TournamentSchema = new Schema<ITournament>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    status: {
      type: String,
      enum: ["DRAFT", "REG_OPEN", "LOCKED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      default: "DRAFT",
      index: true,
    },
    seedingMethod: {
      type: String,
      enum: ["FIRST_COME", "RANDOM", "MANUAL"],
      default: "FIRST_COME",
    },
    bracketSize: { type: Number, min: 2 },
    maxTeams: { type: Number, min: 2 },
    registrationOpensAt: { type: Date },
    registrationClosesAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    teamCount: { type: Number, default: 0 },
    waitlistCount: { type: Number, default: 0 },
    notes: { type: String },
  },
  { timestamps: true, versionKey: false }
);

export const Tournament = mongoose.models.Tournament ??
  mongoose.model<ITournament>("Tournament", TournamentSchema);
