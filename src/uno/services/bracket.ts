// src/services/bracket.ts (helpers you can call from commands)
import { Types } from "mongoose";
import { Tournament } from "../../models/uno/tournament";
import { Team } from "../../models/uno/team";
import { Match } from "../../models/uno/match";

/** Small helpers for standard single-elim mapping */
export const nextRoundFor = (round: number) => round + 1;
export const nextMatchNumberFor = (matchNumber: number) => Math.ceil(matchNumber / 2);

/** Create Round 1 matches from seeds (1 vs 2, 3 vs 4, ... or shuffle for RANDOM). */
export async function generateRoundOneMatches(tournamentId: Types.ObjectId) {
  const t = await Tournament.findById(tournamentId);
  if (!t) throw new Error("Tournament not found");
  if (t.status !== "LOCKED") throw new Error("Tournament must be LOCKED to generate matches");

  const teams = await Team.find({ tournamentId, status: "ACTIVE" }).sort({ seed: 1, createdAt: 1 });
  const count = teams.length;
  if (count < 2) throw new Error("Not enough teams");

  // Calculate how many teams get byes to Round 2
  const teamsInRound1 = count % 2 === 0 ? count : count - 1;
  const teamsWithByes = count - teamsInRound1;

  const matches: any[] = [];

  // Round 1: pair teams that need to play
  let matchNo = 1;
  for (let i = 0; i < teamsInRound1; i += 2) {
    matches.push({
      tournamentId,
      round: 1,
      matchNumber: matchNo++,
      teamAId: teams[i]?._id,
      teamBId: teams[i + 1]?._id,
      status: "PENDING" as const,
      nextRound: nextRoundFor(1),
      nextMatchNumber: nextMatchNumberFor(matchNo - 1),
    });
  }
  
  // Calculate remaining rounds needed
  const totalTeamsAfterRound1 = Math.ceil(teamsInRound1 / 2) + teamsWithByes;
  const rounds = Math.ceil(Math.log2(totalTeamsAfterRound1)) + 1; // Add 1 for the final round
  
  // Create all Round 2 matches (including bye matches)
  const round2Matches = Math.ceil(totalTeamsAfterRound1 / 2);
  
  for (let m = 1; m <= round2Matches; m++) {
    matches.push({
      tournamentId,
      round: 2,
      matchNumber: m,
      teamAId: undefined,
      teamBId: undefined,
      status: "PENDING" as const,
      nextRound: nextRoundFor(2),
      nextMatchNumber: nextMatchNumberFor(m),
    });
  }
  
  // Assign bye teams to the last Round 2 matches
  if (teamsWithByes > 0) {
    const round1MatchCount = teamsInRound1 / 2; // Number of Round 1 matches
    for (let i = 0; i < teamsWithByes; i++) {
      const byeTeamNumber = teamsInRound1 + i;
      const matchIndex = round1MatchCount + round2Matches - teamsWithByes + i;
      matches[matchIndex].teamAId = teams[byeTeamNumber]._id;
    }
  }
  
  // Higher rounds: create empty slots that will receive winners
  for (let r = 3; r <= rounds; r++) {
    // Calculate how many teams advance to this round
    const teamsInThisRound = Math.ceil(totalTeamsAfterRound1 / Math.pow(2, r - 2));
    const matchesInThisRound = Math.floor(teamsInThisRound / 2); // Only create matches for pairs
    const byesInThisRound = teamsInThisRound % 2; // Teams that get byes
    
    // Create matches for pairs
    for (let m = 1; m <= matchesInThisRound; m++) {
      matches.push({
        tournamentId,
        round: r,
        matchNumber: m,
        teamAId: undefined,
        teamBId: undefined,
        status: "PENDING" as const,
        nextRound: nextRoundFor(r),
        nextMatchNumber: nextMatchNumberFor(m),
      });
    }
    
    // Note: Byes are handled by advancing teams directly to the next round
    // We don't create separate "bye matches" - byes advance automatically
  }

  // Use bulk upsert for efficiency
  const writes = matches.map((doc) =>
    Match.updateOne(
      { tournamentId: doc.tournamentId, round: doc.round, matchNumber: doc.matchNumber },
      { $setOnInsert: doc },
      { upsert: true }
    )
  );
  await Promise.all(writes);
}

/** Record a result and advance winner to the next match slot */
export async function reportMatchResult(opts: {
  tournamentId: Types.ObjectId;
  round: number;
  matchNumber: number;
  winner: "A" | "B" | "BYE" | "DQ_A" | "DQ_B";
  score?: string;
  dqReason?: string;
}) {
  const m = await Match.findOne({
    tournamentId: opts.tournamentId,
    round: opts.round,
    matchNumber: opts.matchNumber,
  });
  if (!m) throw new Error("Match not found");
  if (m.status === "COMPLETE") return m;

  let winnerTeamId: Types.ObjectId | undefined;
  let loserTeamId: Types.ObjectId | undefined;
  let result: any;

  switch (opts.winner) {
    case "A":
      winnerTeamId = m.teamAId!;
      loserTeamId = m.teamBId!;
      result = "TEAM_A";
      break;
    case "B":
      winnerTeamId = m.teamBId!;
      loserTeamId = m.teamAId!;
      result = "TEAM_B";
      break;
    case "BYE":
      winnerTeamId = m.teamAId ?? m.teamBId;
      result = "BYE";
      break;
    case "DQ_A":
      winnerTeamId = m.teamBId!;
      loserTeamId = m.teamAId!;
      result = "DQ_A";
      break;
    case "DQ_B":
      winnerTeamId = m.teamAId!;
      loserTeamId = m.teamBId!;
      result = "DQ_B";
      break;
  }

  m.status = "COMPLETE";
  m.completedAt = new Date();
  m.winnerTeamId = winnerTeamId;
  m.loserTeamId = loserTeamId;
  m.result = result;
  if (opts.score) m.score = opts.score;
  if (opts.dqReason) m.dqReason = opts.dqReason;
  await m.save();

  // Advance winner to next round slot if there is a next round
  if (m.nextRound && m.nextMatchNumber && winnerTeamId) {
    const next = await Match.findOne({
      tournamentId: opts.tournamentId,
      round: m.nextRound,
      matchNumber: m.nextMatchNumber,
    });

    // Decide whether winner fills A or B slot: if next matchNumber came from odd current,
    // place as teamA; if from even, place as teamB. (This keeps bracket tidy.)
    const fromOdd = m.matchNumber % 2 === 1;
    if (!next) {
      await Match.create({
        tournamentId: opts.tournamentId,
        round: m.nextRound,
        matchNumber: m.nextMatchNumber,
        teamAId: fromOdd ? winnerTeamId : undefined,
        teamBId: fromOdd ? undefined : winnerTeamId,
        status: "PENDING",
        nextRound: nextRoundFor(m.nextRound),
        nextMatchNumber: nextMatchNumberFor(m.nextMatchNumber),
      });
    } else {
      if (fromOdd) next.teamAId = winnerTeamId;
      else next.teamBId = winnerTeamId;
      await next.save();
    }
  }

  return m;
}
