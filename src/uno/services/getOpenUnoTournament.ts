// src/services/getOpenUnoTournament.ts
import { Tournament } from "../../models/uno/tournament";

export async function getOpenUnoTournament() {
  // If you have a game field, filter by it. Otherwise, just grab the single REG_OPEN tourney.
  const t = await Tournament.findOne({ status: "REG_OPEN" });
  if (!t) throw new Error("No open UNO tournament for registration.");
  return t;
}
