import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { Types } from "mongoose";
import { Match } from "../models/uno/match";
import { Team } from "../models/uno/team";
import { Tournament } from "../models/uno/tournament";

// Optional: register a font (fallback to system default if not found)
try {
  GlobalFonts.registerFromPath("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "DejaVuSans");
} catch {}

type Pos = { x: number; y: number };
type MatchKey = `${number}:${number}`;

function key(r: number, m: number): MatchKey {
  return `${r}:${m}`;
}

export async function renderUnoBracketPNG(tournamentId: Types.ObjectId): Promise<Buffer> {
  const t = await Tournament.findById(tournamentId);
  if (!t) throw new Error("Tournament not found");

  const matches = await Match.find({ tournamentId })
    .sort({ round: 1, matchNumber: 1 })
    .lean();

  if (!matches.length) {
    // No generated matches yet (pre-start). Fake matches from teams so players can preview.
    const activeTeams = await Team.find({ tournamentId, status: "ACTIVE" })
      .sort({ seed: 1, createdAt: 1 })
      .lean();
    if (activeTeams.length < 2) {
      throw new Error("Not enough data to render a bracket.");
    }
    
    const count = activeTeams.length;
    const teamsInRound1 = count % 2 === 0 ? count : count - 1;
    const teamsWithByes = count - teamsInRound1;
    
    // Create Round 1 preview matches
    const round1Teams = activeTeams.slice(0, teamsInRound1);
    const pairs = [];
    for (let i = 0; i < round1Teams.length; i += 2) {
      const a = round1Teams[i]?._id;
      const b = round1Teams[i + 1]?._id;
      pairs.push({
        round: 1,
        matchNumber: pairs.length + 1,
        teamAId: a,
        teamBId: b,
      } as any);
    }
    (matches as any).push(...pairs);
    
    // Create Round 2 preview matches for teams with byes
    if (teamsWithByes > 0) {
      const byeTeams = activeTeams.slice(teamsInRound1);
      const totalTeamsAfterRound1 = Math.ceil(teamsInRound1 / 2) + teamsWithByes;
      const round2Matches = Math.ceil(totalTeamsAfterRound1 / 2);
      
      // Create all Round 2 matches (empty slots)
      for (let m = 1; m <= round2Matches; m++) {
        (matches as any).push({
          round: 2,
          matchNumber: m,
          teamAId: undefined,
          teamBId: undefined,
        } as any);
      }
      
      // Assign bye teams to the last Round 2 matches
      const round1MatchCount = teamsInRound1 / 2;
      for (let i = 0; i < teamsWithByes; i++) {
        const byeTeam = byeTeams[i];
        const matchIndex = round1MatchCount + round2Matches - teamsWithByes + i;
        (matches as any)[matchIndex].teamAId = byeTeam._id;
      }
    }
  }

  const maxRound = Math.max(...matches.map((m) => m.round));
  const rounds: Map<number, any[]> = new Map();
  for (let r = 1; r <= maxRound; r++) rounds.set(r, []);
  for (const m of matches) {
    rounds.get(m.round)!.push(m);
  }
  for (const r of rounds.keys()) {
    rounds.get(r)!.sort((a, b) => a.matchNumber - b.matchNumber);
  }

  // Fetch team map
  const teamIds = Array.from(
    new Set(
      matches.flatMap((m) => [m.teamAId?.toString(), m.teamBId?.toString()]).filter(Boolean) as string[]
    )
  );
  const teamDocs = await Team.find({ _id: { $in: teamIds } }).lean();
  const teamById = new Map<string, (typeof teamDocs)[number]>();
  for (const td of teamDocs) teamById.set((td as any)._id.toString(), td);

  // Layout constants
  const margin = 40;
  const boxW = 260;
  const boxH = 64;
  const hGap = 100; // horizontal gap between rounds
  const rowGap = 42; // vertical gap between round-1 matches

  const round1Matches = rounds.get(1)?.length ?? 1;
  const width = margin * 2 + maxRound * boxW + (maxRound - 1) * hGap;
  
  // Calculate height based on the maximum number of matches in any round
  // This accounts for byes creating additional Round 2 matches
  let maxMatchesInAnyRound = round1Matches;
  for (let r = 2; r <= maxRound; r++) {
    const roundMatches = rounds.get(r)?.length ?? 0;
    maxMatchesInAnyRound = Math.max(maxMatchesInAnyRound, roundMatches);
  }
  
  const height = margin * 2 + Math.max(1, maxMatchesInAnyRound) * (boxH + rowGap);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#0b0f14";
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px DejaVuSans, system-ui, sans-serif";
  ctx.fillText(`UNO Bracket — ${t?.name ?? ""}`, margin, 28);

  // Calculate positions
  const pos = new Map<MatchKey, Pos>();

  // Round 1 Y positions: stack vertically
  const r1 = rounds.get(1) ?? [];
  for (let i = 0; i < r1.length; i++) {
    const x = margin;
    const y = margin + (i + 0.5) * (boxH + rowGap);
    pos.set(key(1, r1[i].matchNumber), { x, y });
  }

  // Higher rounds: center between feeder matches
  for (let r = 2; r <= maxRound; r++) {
    const rm = rounds.get(r) ?? [];
    const x = margin + (r - 1) * (boxW + hGap);
    
    // Calculate available vertical space
    const availableHeight = height - margin * 2;
    const totalSpacing = (rm.length - 1) * rowGap;
    const totalBoxHeight = rm.length * boxH;
    const startY = margin + (availableHeight - totalBoxHeight - totalSpacing) / 2;
    
    for (let i = 0; i < rm.length; i++) {
      const mN = rm[i].matchNumber;
      const feederA = pos.get(key(r - 1, 2 * mN - 1));
      const feederB = pos.get(key(r - 1, 2 * mN));
      
      let y;
      if (feederA && feederB) {
        // Normal case: center between two feeders
        y = (feederA.y + feederB.y) / 2;
      } else {
        // Fallback for byes: distribute evenly across available space
        y = startY + i * (boxH + rowGap) + boxH / 2;
      }
      
      pos.set(key(r, mN), { x, y });
    }
  }

  // Helper draw funcs
  const roundColor = (r: number) => ["#1e293b", "#1f2a3a", "#233247", "#273a54", "#2b4161"][Math.min(r - 1, 4)];
  const strokeColor = "#6b7280";
  const textColor = "#e5e7eb";
  const winnerColor = "#22c55e";
  const loserColor = "#94a3b8";

  function teamLabel(teamId?: Types.ObjectId | string | null) {
    if (!teamId) return "TBD";
    const t = teamById.get(teamId.toString());
    if (!t) return "TBD";
    if (t.teamName) return t.teamName;
    return t.memberIds?.length ? t.memberIds.map((id: string) => `@${id}`).join(" & ") : "TBD";
  }

  // Draw connectors first (beneath boxes)
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;

  for (let r = 1; r < maxRound; r++) {
    const rm = rounds.get(r) ?? [];
    for (const m of rm) {
      const from = pos.get(key(r, m.matchNumber))!;
      
      // Calculate next round and match
      let nextRound = r + 1;
      let nextMatch = Math.ceil(m.matchNumber / 2);
      
      // Special case: Round 3 Match 3 in 24-team bracket connects directly to Round 5 Match 1
      if (r === 3 && m.matchNumber === 3 && maxRound >= 5) {
        nextRound = 5;
        nextMatch = 1;
      }
      
      const to = pos.get(key(nextRound, nextMatch))!;
      const x1 = from.x + boxW;
      const y1 = from.y;
      const xMid = from.x + boxW + hGap / 2;
      const x2 = to.x;
      const y2 = to.y;

      // ├─ horiz to mid
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(xMid, y1);
      ctx.stroke();

      // │ vertical
      ctx.beginPath();
      ctx.moveTo(xMid, y1);
      ctx.lineTo(xMid, y2);
      ctx.stroke();

      // ─┤ horiz to next round box edge
      ctx.beginPath();
      ctx.moveTo(xMid, y2);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  // Draw matches (boxes + labels)
  for (let r = 1; r <= maxRound; r++) {
    const rm = rounds.get(r) ?? [];
    for (const m of rm) {
      const p = pos.get(key(r, m.matchNumber))!;
      const x = p.x;
      const y = p.y;

      // Box
      ctx.fillStyle = roundColor(r);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      const ry = 10;

      // Rounded rect
      ctx.beginPath();
      ctx.moveTo(x, y - boxH / 2 + ry);
      ctx.arcTo(x, y - boxH / 2, x + ry, y - boxH / 2, ry);
      ctx.arcTo(x + boxW, y - boxH / 2, x + boxW, y - boxH / 2 + ry, ry);
      ctx.arcTo(x + boxW, y + boxH / 2, x + boxW - ry, y + boxH / 2, ry);
      ctx.arcTo(x, y + boxH / 2, x, y + boxH / 2 - ry, ry);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Labels
      const aName = teamLabel((m as any).teamAId);
      const bName = teamLabel((m as any).teamBId);

      // Winner highlighting if known
      const winnerId = (m as any).winnerTeamId?.toString();
      const aIsWinner = winnerId && (m as any).teamAId && (m as any).teamAId.toString() === winnerId;
      const bIsWinner = winnerId && (m as any).teamBId && (m as any).teamBId.toString() === winnerId;

      ctx.font = "bold 14px DejaVuSans, system-ui, sans-serif";
      ctx.fillStyle = aIsWinner ? winnerColor : textColor;
      ctx.fillText(aName, x + 10, y - 8, boxW - 20);

      ctx.font = "bold 14px DejaVuSans, system-ui, sans-serif";
      ctx.fillStyle = bIsWinner ? winnerColor : textColor;
      ctx.fillText(bName, x + 10, y + 18, boxW - 20);

      // Small meta (round/match)
      ctx.font = "12px DejaVuSans, system-ui, sans-serif";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText(`R${m.round} • M${m.matchNumber}`, x + boxW - 90, y + boxH / 2 - 8);
    }
  }

  return canvas.toBuffer("image/png");
}
