// src/models/team.ts
import mongoose, { Schema, Types } from "mongoose";

export type TeamStatus = "ACTIVE" | "WAITLIST" | "DQ" | "WITHDRAWN";

export interface ITeam {
  tournamentId: Types.ObjectId;
  teamName: string;
  memberIds: string[];         // Discord user IDs (length 1..2)
  captainId?: string;          // optional
  ownerId?: string;            // who created the team
  seed?: number;               // fixed at LOCK time
  status: TeamStatus;
  dqReason?: string;
  dqDate?: Date;
}

const TeamSchema = new Schema<ITeam>(
  {
    tournamentId: { type: Schema.Types.ObjectId, ref: "Tournament", required: true, index: true },
    teamName: { type: String, required: true, trim: true },
    memberIds: {
      type: [String],
      validate: {
        validator: (arr: string[]) => Array.isArray(arr) && arr.length >= 1 && arr.length <= 2,
        message: "A team must have 1 or 2 members.",
      },
      required: true,
    },
    captainId: { type: String },
    ownerId: { type: String },
    seed: { type: Number, min: 1 },
    status: {
      type: String,
      enum: ["ACTIVE", "WAITLIST", "DQ", "WITHDRAWN"],
      default: "WAITLIST",
      index: true,
    },
    dqReason: { type: String },
    dqDate: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

// Unique team name per tournament
TeamSchema.index({ tournamentId: 1, teamName: 1 }, { unique: true });

// Helper to enforce unique user across teams in same tournament (soft check)
TeamSchema.index({ tournamentId: 1, memberIds: 1 });

export const Team = mongoose.models.Team ?? mongoose.model<ITeam>("Team", TeamSchema);
