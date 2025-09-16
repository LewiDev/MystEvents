// src/models/match.ts
import mongoose, { Schema, Types } from "mongoose";

export type MatchStatus = "PENDING" | "ONGOING" | "COMPLETE";
export type MatchResult = "TEAM_A" | "TEAM_B" | "BYE" | "DQ_A" | "DQ_B";

export interface IMatch {
  tournamentId: Types.ObjectId;
  round: number;            // 1 = Round of 16, etc.
  matchNumber: number;      // 1-based within the round
  teamAId?: Types.ObjectId; // may be undefined initially (bye or not seeded yet)
  teamBId?: Types.ObjectId;

  status: MatchStatus;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;

  // Result
  winnerTeamId?: Types.ObjectId;
  loserTeamId?: Types.ObjectId;
  result?: MatchResult;
  score?: string;           // optional free-form (e.g., "2-1") if you track sets/hands

  // DQ handling
  dqReason?: string;        // if the match ended via any DQ, note why

  // Linking to the next round slot (implicit by math, but we store for convenience if you like)
  nextRound?: number;
  nextMatchNumber?: number;
}

const MatchSchema = new Schema<IMatch>(
  {
    tournamentId: { type: Schema.Types.ObjectId, ref: "Tournament", required: true, index: true },
    round: { type: Number, required: true, min: 1, index: true },
    matchNumber: { type: Number, required: true, min: 1, index: true },
    teamAId: { type: Schema.Types.ObjectId, ref: "Team" },
    teamBId: { type: Schema.Types.ObjectId, ref: "Team" },
    status: { type: String, enum: ["PENDING", "ONGOING", "COMPLETE"], default: "PENDING", index: true },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },

    winnerTeamId: { type: Schema.Types.ObjectId, ref: "Team" },
    loserTeamId: { type: Schema.Types.ObjectId, ref: "Team" },
    result: { type: String, enum: ["TEAM_A", "TEAM_B", "BYE", "DQ_A", "DQ_B"] },
    score: { type: String },

    dqReason: { type: String },

    nextRound: { type: Number },
    nextMatchNumber: { type: Number },
  },
  { timestamps: true, versionKey: false }
);

// Unique per tournament/round/matchNumber
MatchSchema.index({ tournamentId: 1, round: 1, matchNumber: 1 }, { unique: true });

export const Match = mongoose.models.Match ?? mongoose.model<IMatch>("Match", MatchSchema);
