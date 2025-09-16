import { Types, ClientSession } from "mongoose";
import { Team, ITeam } from "../../models/uno/team";
import { Tournament } from "../../models/uno/tournament";

/** Helper: ensure a user is not already on an ACTIVE or WAITLIST team in this tournament */
async function assertMembersUniqueInTournament(
  tournamentId: Types.ObjectId,
  memberIds: string[],
  excludeTeamId?: Types.ObjectId
) {
  if (!memberIds.length) return;

  const conflict = await Team.findOne({
    tournamentId,
    _id: excludeTeamId ? { $ne: excludeTeamId } : { $exists: true },
    status: { $in: ["ACTIVE", "WAITLIST"] },
    memberIds: { $in: memberIds },
  }).lean();

  if (conflict) {
    throw new Error("One or more members are already registered on another team in this tournament.");
  }
}

export const TeamService = {
  /** Create a team (defaults to WAITLIST until promoted/locked). */
  async registerTeam(opts: {
    tournamentId: Types.ObjectId;
    ownerId: string;
    memberIds: string[];   // length 1..2, include ownerId if owner plays
    teamName: string;
    preferredStatus?: ITeam["status"]; // "WAITLIST" | "ACTIVE"
    session?: ClientSession;
  }) {
    const t = await Tournament.findById(opts.tournamentId);
    if (!t) throw new Error("Tournament not found");
    if (!["REG_OPEN", "DRAFT"].includes(t.status)) {
      throw new Error("Registration is not open.");
    }

    const memberIds = Array.from(new Set(opts.memberIds));
    if (memberIds.length < 1 || memberIds.length > 2) {
      throw new Error("A team must have 1 or 2 members.");
    }

    await assertMembersUniqueInTournament(opts.tournamentId, memberIds);

    // Decide status
    let status: ITeam["status"] = opts.preferredStatus ?? "WAITLIST";
    if (t.maxTeams && t.teamCount >= t.maxTeams) status = "WAITLIST";
    if (t.status === "DRAFT") status = "WAITLIST"; // safe default

    const doc = await Team.create(
      [
        {
          tournamentId: opts.tournamentId,
          teamName: opts.teamName.trim(),
          memberIds,
          ownerId: opts.ownerId,
          captainId: memberIds[0],
          status,
        },
      ],
      { session: opts.session }
    );

    // bump counters
    const inc: Record<string, number> = {};
    if (status === "WAITLIST") inc.waitlistCount = 1;
    else inc.teamCount = 1;

    await Tournament.updateOne(
      { _id: opts.tournamentId },
      { $inc: inc },
      { session: opts.session }
    );

    return doc[0];
  },

  async setTeamName(teamId: Types.ObjectId, teamName: string) {
    const team = await Team.findById(teamId);
    if (!team) throw new Error("Team not found");
    // ensure unique name within tournament
    const exists = await Team.findOne({
      tournamentId: team.tournamentId,
      _id: { $ne: team._id },
      teamName: teamName.trim(),
    }).lean();
    if (exists) throw new Error("Team name already in use in this tournament.");
    team.teamName = teamName.trim();
    await team.save();
    return team;
  },

  async addMember(teamId: Types.ObjectId, userId: string) {
    const team = await Team.findById(teamId);
    if (!team) throw new Error("Team not found");
    if (team.memberIds.includes(userId)) return team;
    if (team.memberIds.length >= 2) throw new Error("This team already has 2 members.");
    await assertMembersUniqueInTournament(team.tournamentId as Types.ObjectId, [userId], team._id);
    team.memberIds.push(userId);
    if (!team.captainId) team.captainId = userId;
    await team.save();
    return team;
  },

  async removeMember(teamId: Types.ObjectId, userId: string) {
    const team = await Team.findById(teamId);
    if (!team) throw new Error("Team not found");

    team.memberIds = team.memberIds.filter((m: string) => m !== userId);
    if (team.captainId === userId) {
      team.captainId = team.memberIds[0]; // next available or undefined
    }
    if (team.memberIds.length === 0) {
      // auto-withdraw if no members remain
      team.status = "WITHDRAWN";
    }
    await team.save();
    return team;
  },

  /** Promote a team from WAITLIST to ACTIVE (if capacity), typically before LOCK. */
  async promoteFromWaitlist(tournamentId: Types.ObjectId, teamId: Types.ObjectId) {
    const t = await Tournament.findById(tournamentId);
    if (!t) throw new Error("Tournament not found");
    if (!["REG_OPEN", "DRAFT"].includes(t.status)) {
      throw new Error("Cannot promote teams after lock/start.");
    }

    const team = await Team.findOne({ _id: teamId, tournamentId });
    if (!team) throw new Error("Team not found");
    if (team.status !== "WAITLIST") return team;

    // enforce capacity if bracketSize/maxTeams is defined
    if (typeof t.maxTeams === "number" && t.teamCount >= t.maxTeams) {
      throw new Error("Tournament is at capacity.");
    }

    team.status = "ACTIVE";
    await team.save();

    await Tournament.updateOne(
      { _id: tournamentId },
      { $inc: { teamCount: 1, waitlistCount: -1 } }
    );

    return team;
  },

  /** Mark a team as DQ and (optionally) store reason/date. */
  async disqualifyTeam(teamId: Types.ObjectId, reason?: string) {
    const team = await Team.findById(teamId);
    if (!team) throw new Error("Team not found");
    team.status = "DQ";
    team.dqReason = reason;
    team.dqDate = new Date();
    await team.save();
    return team;
  },

  /** Team withdraws pre-start or mid-event (admin flow). */
  async withdrawTeam(teamId: Types.ObjectId) {
    const team = await Team.findById(teamId);
    if (!team) throw new Error("Team not found");
    if (team.status === "WITHDRAWN") return team;

    // Adjust counters on tournament if leaving before start/without replacement
    const inc: Record<string, number> = {};
    if (team.status === "ACTIVE") inc.teamCount = -1;
    if (team.status === "WAITLIST") inc.waitlistCount = -1;

    team.status = "WITHDRAWN";
    await team.save();

    await Tournament.updateOne({ _id: team.tournamentId }, { $inc: inc });
    return team;
  },
};
