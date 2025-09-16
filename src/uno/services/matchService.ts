import { Types } from "mongoose";
import { Match } from "../../models/uno/match";
import { reportMatchResult } from "./bracket";

export const MatchService = {
  async scheduleMatch(opts: {
    tournamentId: Types.ObjectId;
    round: number;
    matchNumber: number;
    scheduledAt: Date;
  }) {
    const m = await Match.findOneAndUpdate(
      {
        tournamentId: opts.tournamentId,
        round: opts.round,
        matchNumber: opts.matchNumber,
      },
      { $set: { scheduledAt: opts.scheduledAt } },
      { new: true }
    );
    if (!m) throw new Error("Match not found");
    return m;
  },

  async startMatch(opts: { tournamentId: Types.ObjectId; round: number; matchNumber: number }) {
    const m = await Match.findOneAndUpdate(
      { tournamentId: opts.tournamentId, round: opts.round, matchNumber: opts.matchNumber },
      { $set: { status: "ONGOING", startedAt: new Date() } },
      { new: true }
    );
    if (!m) throw new Error("Match not found");
    return m;
  },

  /**
   * winner: "A" | "B" | "BYE" | "DQ_A" | "DQ_B"
   * Automatically advances the winner to the next match slot.
   */
  async submitResult(opts: {
    tournamentId: Types.ObjectId;
    round: number;
    matchNumber: number;
    winner: "A" | "B" | "BYE" | "DQ_A" | "DQ_B";
    score?: string;
    dqReason?: string;
  }) {
    const m = await reportMatchResult(opts);
    return m;
  },
};
