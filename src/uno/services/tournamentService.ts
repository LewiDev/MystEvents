import { Types } from "mongoose";
import { Tournament, ITournament } from "../../models/uno/tournament";
import { Team } from "../../models/uno/team";
import { generateRoundOneMatches } from "./bracket";

export const TournamentService = {
  async createTournament(data: Pick<ITournament, "name" | "seedingMethod"> & Partial<ITournament>) {
    const doc = await Tournament.create({
      name: data.name.trim(),
      seedingMethod: data.seedingMethod ?? "FIRST_COME",
      status: data.status ?? "DRAFT",
      bracketSize: data.bracketSize,
      maxTeams: data.maxTeams,
      registrationOpensAt: data.registrationOpensAt,
      registrationClosesAt: data.registrationClosesAt,
      notes: data.notes,
    });
    return doc;
  },

  async openRegistration(tournamentId: Types.ObjectId) {
    const t = await Tournament.findById(tournamentId);
    if (!t) throw new Error("Tournament not found");
    if (!["DRAFT", "REG_OPEN"].includes(t.status)) {
      throw new Error(`Cannot open registration from ${t.status}.`);
    }
    t.status = "REG_OPEN";
    await t.save();
    return t;
  },

  /** Lock registrations and assign seeds to ACTIVE teams. */
  async lockTournamentAndSeed(tournamentId: Types.ObjectId) {
    const t = await Tournament.findById(tournamentId);
    if (!t) throw new Error("Tournament not found");
    if (t.status !== "REG_OPEN") throw new Error("Tournament must be in REG_OPEN to lock.");

    const activeTeams = await Team.find({ tournamentId, status: "ACTIVE" }).sort({ createdAt: 1 });
    if (activeTeams.length < 2) throw new Error("Not enough teams to start.");

    // Decide seeds:
    // - FIRST_COME: createdAt order
    // - RANDOM: shuffle
    // - MANUAL: keep existing 'seed' if already set; otherwise assign after
    let ordering = activeTeams;
    if (t.seedingMethod === "RANDOM") {
      ordering = [...activeTeams].sort(() => Math.random() - 0.5);
    } else if (t.seedingMethod === "MANUAL") {
      // preserve existing numbers; put unseeded at end and assign remaining
      const seeded = activeTeams.filter((a) => typeof a.seed === "number").sort((a, b) => (a.seed! - b.seed!));
      const unseeded = activeTeams.filter((a) => typeof a.seed !== "number");
      ordering = [...seeded, ...unseeded];
    }

    // Apply seeds sequentially
    for (let i = 0; i < ordering.length; i++) {
      if (typeof ordering[i].seed !== "number") {
        ordering[i].seed = i + 1;
        await ordering[i].save();
      }
    }

    t.status = "LOCKED";
    t.registrationClosesAt = new Date();
    await t.save();
    return t;
  },

  /** Generate Round 1 matches and set IN_PROGRESS. */
  async startTournament(tournamentId: Types.ObjectId) {
    const t = await Tournament.findById(tournamentId);
    if (!t) throw new Error("Tournament not found");
    if (t.status !== "LOCKED") throw new Error("Tournament must be LOCKED to start.");

    await generateRoundOneMatches(tournamentId);

    t.status = "IN_PROGRESS";
    t.startedAt = new Date();
    await t.save();
    return t;
  },

  async completeTournament(tournamentId: Types.ObjectId) {
    const t = await Tournament.findById(tournamentId);
    if (!t) throw new Error("Tournament not found");
    t.status = "COMPLETED";
    t.completedAt = new Date();
    await t.save();
    return t;
  },

  /** Optional: recompute seeds before lock (e.g., switch method). */
  async recomputeSeeds(tournamentId: Types.ObjectId, method: ITournament["seedingMethod"]) {
    const t = await Tournament.findById(tournamentId);
    if (!t) throw new Error("Tournament not found");
    if (t.status !== "REG_OPEN") throw new Error("Can only reseed before lock.");
    t.seedingMethod = method;
    await t.save();
    return t;
  },
};
