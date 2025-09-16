// src/commands/misc/uno.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Message,
  PermissionsBitField,
  TextChannel,
  userMention,
} from "discord.js";
import { Types } from "mongoose";
import { Command } from "../../types";
import { logger } from "../../utils/logger";

import { Tournament } from "../../models/uno/tournament";
import { Team } from "../../models/uno/team";
import { Invite } from "../../models/uno/invite";

import { TeamService } from "../../uno/services/teamService";
import { TournamentService } from "../../uno/services/tournamentService";
import { MatchService } from "../../uno/services/matchService";
import { getOpenUnoTournament } from "../../uno/services/getOpenUnoTournament";

// Find the single current tournament
async function findCurrentTournament() {
  return Tournament.findOne({
    status: { $in: ["DRAFT", "REG_OPEN", "LOCKED", "IN_PROGRESS"] },
  }).sort({ createdAt: -1 });
}

function chunkLines(lines: string[], maxChars = 3500): string[] {
  const chunks: string[] = [];
  let buf: string[] = [];
  let len = 0;
  for (const line of lines) {
    if (len + line.length + 1 > maxChars) {
      chunks.push(buf.join("\n"));
      buf = [];
      len = 0;
    }
    buf.push(line);
    len += line.length + 1;
  }
  if (buf.length) chunks.push(buf.join("\n"));
  return chunks;
}

function fmtMembers(memberIds: string[]) {
  if (!memberIds?.length) return "_no members_";
  return memberIds.map((id) => `<@${id}>`).join(" & ");
}

async function buildRegistrationEmbeds(tournamentId: Types.ObjectId) {
  const t = await Tournament.findById(tournamentId);
  if (!t) throw new Error("Tournament not found");

  const active = await Team.find({ tournamentId, status: "ACTIVE" }).sort({ seed: 1, createdAt: 1 });
  const wait   = await Team.find({ tournamentId, status: "WAITLIST" }).sort({ createdAt: 1 });

  const activeLines = active.length
    ? active.map((team, i) => {
        const seed = team.seed ? ` (seed ${team.seed})` : "";
        return `${i + 1}. **${team.teamName}**${seed}\n   — ${fmtMembers(team.memberIds)}`;
      })
    : ["_No registered teams yet._"];

  const waitLines = wait.length
    ? wait.map((team, i) => `${i + 1}. **${team.teamName}**\n   — ${fmtMembers(team.memberIds)}`)
    : ["_No teams on the waitlist._"];

  const header = `**${t.name}** — **${t.status}**\nRegistered: ${active.length}${t.maxTeams ? ` / ${t.maxTeams}` : ""} • Waitlist: ${wait.length}`;

  // Build embeds, chunking long sections
  const embeds: EmbedBuilder[] = [];

  // First embed: header + first chunk of Active
  const activeChunks = chunkLines(activeLines);
  const waitChunks   = chunkLines(waitLines);

  const first = new EmbedBuilder()
    .setTitle("UNO Registration")
    .setDescription(`${header}\n\n**Registered Teams**\n${activeChunks[0] ?? "_No registered teams yet._"}`);
  embeds.push(first);

  // Remaining active chunks
  for (let i = 1; i < activeChunks.length; i++) {
    embeds.push(
      new EmbedBuilder()
        .setTitle("UNO Registration — Registered (cont.)")
        .setDescription(activeChunks[i])
    );
  }

  // Waitlist chunks
  for (let i = 0; i < waitChunks.length; i++) {
    embeds.push(
      new EmbedBuilder()
        .setTitle(i === 0 ? "UNO Registration — Waitlist" : "UNO Registration — Waitlist (cont.)")
        .setDescription(waitChunks[i])
    );
  }

  return embeds;
}

const ADMIN_ROLE_ID = process.env.UNO_ADMIN_ROLE_ID ?? "1355718147193311321"; // optional role override
const CUSTOM_ID_PREFIX = "uno_invite";

function isAdmin(msg: Message) {
  if (ADMIN_ROLE_ID && msg.member?.roles.cache.has(ADMIN_ROLE_ID)) return true;
  return msg.member?.permissions.has(PermissionsBitField.Flags.ManageGuild);
}
function isUserMention(arg?: string) {
  return !!arg && /^<@!?(\d+)>$/.test(arg);
}
function extractIdFromMention(mention: string) {
  const m = mention.match(/^<@!?(\d+)>$/);
  return m?.[1];
}
function parseIntStrict(s?: string) {
  const n = Number(s);
  return Number.isInteger(n) ? n : undefined;
}
async function oneActive() {
  return Tournament.findOne({
    status: { $in: ["DRAFT", "REG_OPEN", "LOCKED", "IN_PROGRESS"] },
  }).sort({ createdAt: -1 });
}

/** Promote first WAITLIST team if capacity allows */
async function promoteNextWaitlistIfRoom(tournamentId: Types.ObjectId) {
  const t = await Tournament.findById(tournamentId);
  if (!t) return;
  if (typeof t.maxTeams !== "number") return;
  if (t.teamCount >= t.maxTeams) return;

  const wait = await Team.findOne({ tournamentId, status: "WAITLIST" }).sort({ createdAt: 1 });
  if (!wait) return;

  await TeamService.promoteFromWaitlist(tournamentId, wait._id);
}

export default {
  name: "uno",
  description: "UNO Event (players + admin via `uno tourney`)",
  aliases: ["uno"],
  cooldown: 0,
  isMessageCommand: true,

  async execute(message: Message, args?: string[]) {
    try {
      if (!args || args.length === 0) {
        await message.reply(
          [
            "**UNO**",
            "`uno register @teammate`",
            "`uno accept @inviter`",
            "`uno leave`",
            "`uno teamname <name>`",
            "",
            "**Admin**",
            "`uno tourney create <name> [maxTeams=16] [seeding=FIRST_COME|RANDOM|MANUAL]`",
            "`uno tourney open | lock | start | complete | cancel`",
            "`uno tourney set maxteams <n> | set bracketsize <n> | reseed <FIRST_COME|RANDOM|MANUAL>`",
            "`uno tourney list teams | list waitlist`",
            "`uno tourney promote <teamId> | dq <teamId> [reason…] | withdraw <teamId>`",
            "`uno tourney match result <round> <matchNumber> <A|B|BYE|DQ_A|DQ_B> [score…]`",
          ].join("\n")
        );
        return;
      }

      // ───────────────────────────────────────────────────────────
      // Admin namespace: "uno tourney ..."
      // ───────────────────────────────────────────────────────────
      if (args[0].toLowerCase() === "tourney") {
        if (!isAdmin(message)) {
          return void message.reply("❌ You don’t have permission to use tournament admin commands.");
        }

        const sub = (args[1] ?? "").toLowerCase();

        // CREATE
        if (sub === "create") {
          const name = args[2];
          if (!name) return void message.reply("Provide a name: `uno tourney create <name> [maxTeams] [seeding]`");
          const maxTeams = parseIntStrict(args[3]) ?? 16; // 8/16/32 typically
          const seeding = (args[4]?.toUpperCase() as any) ?? "FIRST_COME";
          if (!["FIRST_COME", "RANDOM", "MANUAL"].includes(seeding)) {
            return void message.reply("Seeding must be FIRST_COME, RANDOM, or MANUAL.");
          }

          const created = await TournamentService.createTournament({
            name,
            maxTeams,
            bracketSize: maxTeams,
            seedingMethod: seeding,
            status: "DRAFT",
          });

          return void message.reply(
            `✅ Created tournament **${created.name}** (id: \`${created.id}\`) with maxTeams=${maxTeams}, seeding=${seeding}. Use \`uno tourney open\` to start registration.`
          );
        }

        // OPEN
        if (sub === "open") {
          const t = await oneActive();
          if (!t) return void message.reply("No draft tournament found.");
          const res = await TournamentService.openRegistration(t._id);
          return void message.reply(`✅ Registration opened for **${res.name}**.`);
        }

        // LOCK
        if (sub === "lock") {
          const t = await oneActive();
          if (!t) return void message.reply("No active tournament found.");
          const res = await TournamentService.lockTournamentAndSeed(t._id);
          return void message.reply(`🔒 **${res.name}** locked. Seeds assigned. Use \`uno tourney start\` to begin.`);
        }

        // START
        if (sub === "start") {
          const t = await oneActive();
          if (!t) return void message.reply("No locked tournament found.");
          const res = await TournamentService.startTournament(t._id);
          return void message.reply(`🏁 **${res.name}** is now IN_PROGRESS. Round 1 matches generated.`);
        }

        // COMPLETE
        if (sub === "complete") {
          const t = await oneActive();
          if (!t) return void message.reply("No active tournament found.");
          const res = await TournamentService.completeTournament(t._id);
          return void message.reply(`✅ **${res.name}** marked COMPLETED.`);
        }

        // CANCEL
        if (sub === "cancel") {
          const t = await oneActive();
          if (!t) return void message.reply("No active tournament found.");
          t.status = "CANCELLED";
          await t.save();
          return void message.reply(`🛑 **${t.name}** cancelled.`);
        }

        // SET
        if (sub === "set") {
          const which = (args[2] ?? "").toLowerCase();
          const t = await oneActive();
          if (!t) return void message.reply("No active tournament found.");

          if (which === "maxteams") {
            const n = parseIntStrict(args[3]);
            if (!n) return void message.reply("Provide an integer: `uno tourney set maxteams <n>`");
            t.maxTeams = n;
            await t.save();
            return void message.reply(`✅ maxTeams set to ${n}.`);
          }
          if (which === "bracketsize") {
            const n = parseIntStrict(args[3]);
            if (!n) return void message.reply("Provide an integer: `uno tourney set bracketsize <n>`");
            t.bracketSize = n;
            await t.save();
            return void message.reply(`✅ bracketSize set to ${n}.`);
          }
          return void message.reply("Usage: `uno tourney set maxteams <n>` or `uno tourney set bracketsize <n>`");
        }

        // RESEED (before lock)
        if (sub === "reseed") {
          const method = (args[2]?.toUpperCase() as any) ?? "FIRST_COME";
          if (!["FIRST_COME", "RANDOM", "MANUAL"].includes(method)) {
            return void message.reply("Method must be FIRST_COME, RANDOM, or MANUAL.");
          }
          const t = await oneActive();
          if (!t) return void message.reply("No active tournament found.");
          await TournamentService.recomputeSeeds(t._id, method);
          return void message.reply(`🔁 Seeding method set to ${method}.`);
        }

        // LIST
        if (sub === "list") {
          const which = (args[2] ?? "").toLowerCase();
          const t = await oneActive();
          if (!t) return void message.reply("No active tournament found.");

          if (which === "teams") {
            const teams = await Team.find({ tournamentId: t._id, status: "ACTIVE" }).sort({ seed: 1, createdAt: 1 });
            if (!teams.length) return void message.reply("No ACTIVE teams.");
            const lines = teams.map((x) => `• ${x._id} | seed:${x.seed ?? "-"} | ${x.teamName} | members: ${x.memberIds.map(userMention).join(", ")}`);
            return void message.reply(["**Active teams**", ...lines].join("\n"));
          }
          if (which === "waitlist") {
            const teams = await Team.find({ tournamentId: t._id, status: "WAITLIST" }).sort({ createdAt: 1 });
            if (!teams.length) return void message.reply("No WAITLIST teams.");
            const lines = teams.map((x) => `• ${x._id} | ${x.teamName} | members: ${x.memberIds.map(userMention).join(", ")}`);
            return void message.reply(["**Waitlist**", ...lines].join("\n"));
          }
          return void message.reply("Use `uno tourney list teams` or `uno tourney list waitlist`");
        }

        // PROMOTE
        if (sub === "promote") {
          const id = args[2];
          if (!id) return void message.reply("Provide teamId: `uno tourney promote <teamId>`");
          const t = await oneActive();
          if (!t) return void message.reply("No active tournament found.");
          await TeamService.promoteFromWaitlist(t._id, new Types.ObjectId(id));
          return void message.reply(`☑️ Promoted team \`${id}\` to ACTIVE (if capacity allowed).`);
        }

        // DQ
        if (sub === "dq") {
          const id = args[2];
          if (!id) return void message.reply("Provide teamId: `uno tourney dq <teamId> [reason…]`");
          const reason = args.slice(3).join(" ") || undefined;
          await TeamService.disqualifyTeam(new Types.ObjectId(id), reason);
          return void message.reply(`⛔ Team \`${id}\` disqualified${reason ? `: ${reason}` : ""}.`);
        }

        // WITHDRAW
        if (sub === "withdraw") {
          const id = args[2];
          if (!id) return void message.reply("Provide teamId: `uno tourney withdraw <teamId>`");
          await TeamService.withdrawTeam(new Types.ObjectId(id));
          return void message.reply(`🚪 Team \`${id}\` withdrawn.`);
        }

        // MATCH RESULT
        if (sub === "match" && (args[2] ?? "").toLowerCase() === "result") {
          const round = parseIntStrict(args[3]);
          const matchNumber = parseIntStrict(args[4]);
          const winner = (args[5]?.toUpperCase() as "A" | "B" | "BYE" | "DQ_A" | "DQ_B") || undefined;
          const score = args.slice(6).join(" ") || undefined;
          if (!round || !matchNumber || !winner) {
            return void message.reply("Usage: `uno tourney match result <round> <matchNumber> <A|B|BYE|DQ_A|DQ_B> [score…]`");
          }

          const t = await oneActive();
          if (!t) return void message.reply("No active tournament found.");

          await MatchService.submitResult({
            tournamentId: t._id,
            round,
            matchNumber,
            winner,
            score,
          });
          return void message.reply(`✅ Recorded result for R${round} M${matchNumber}: ${winner}${score ? ` (${score})` : ""}.`);
        }

        // Fallback
        return void message.reply("Unknown admin subcommand. Run `uno` for help.");
      }

      // ───────────────────────────────────────────────────────────
      // Player subcommands: register | accept | leave | teamname
      // ───────────────────────────────────────────────────────────
      const sub = args[0]?.toLowerCase();

      // ---- uno bracket ----
      if (sub === "bracket") {
        // Prefer IN_PROGRESS or LOCKED; else show latest with any matches/active teams
        const t =
          (await Tournament.findOne({ status: { $in: ["LOCKED", "IN_PROGRESS"] } }).sort({ createdAt: -1 })) ||
          (await Tournament.findOne({ status: { $in: ["DRAFT", "REG_OPEN"] } }).sort({ createdAt: -1 }));

        if (!t) return void message.reply("No tournament found.");

        try {
          const png = await (await import("../../utils/renderUnoBracket")).renderUnoBracketPNG(t._id);
          await (message.channel as TextChannel).send({
            content: `**UNO Bracket — ${t.name}**`,
            files: [{ attachment: png, name: "uno_bracket.png" }],
          });
        } catch (e) {
          console.error(e);
          await message.reply("❌ Couldn't render the bracket (missing matches or teams?). Try `uno tourney start` first.");
        }
        return;
      }
      // register
      // ---- uno registration ----
      if (sub === "registration") {
        const t = await findCurrentTournament();
        if (!t) return void message.reply("No current UNO tournament found.");

        const embeds = await buildRegistrationEmbeds(t._id);
        // Discord limit: up to 10 embeds per message; if more, send in batches
        const batches: EmbedBuilder[][] = [];
        for (let i = 0; i < embeds.length; i += 10) {
          batches.push(embeds.slice(i, i + 10));
        }
        for (const batch of batches) {
          await (message.channel as TextChannel).send({ embeds: batch });
        }
        return;
      }

      if (sub === "register") {
        const mention = args[1];
        if (!isUserMention(mention)) return void message.reply("Tag the teammate: `uno register @user`");

        const inviterId = message.author.id;
        const inviteeId = extractIdFromMention(mention)!;
        if (inviteeId === inviterId) return void message.reply("You can’t invite yourself.");

        const tournament = await getOpenUnoTournament();

        // inviter team
        let team = await Team.findOne({
          tournamentId: tournament._id,
          memberIds: inviterId,
          status: { $in: ["ACTIVE", "WAITLIST"] },
        });

        if (team && team.memberIds.length >= 2) {
          return void message.reply("Your team already has 2 members.");
        }

        if (!team) {
          team = await TeamService.registerTeam({
            tournamentId: tournament._id,
            ownerId: inviterId,
            memberIds: [inviterId],
            teamName: `${message.author.username}'s Team`,
            preferredStatus: "ACTIVE",
          });
        }

        // invitee free?
        const inviteeExisting = await Team.findOne({
          tournamentId: tournament._id,
          memberIds: inviteeId,
          status: { $in: ["ACTIVE", "WAITLIST"] },
        }).lean();
        if (inviteeExisting) {
          return void message.reply(`${userMention(inviteeId)} is already on another team for this tournament.`);
        }

        // create invite
        const inv = await Invite.create({
          tournamentId: tournament._id,
          teamId: team._id,
          inviterId,
          inviteeId,
          status: "PENDING",
        });

        const acceptId = `${CUSTOM_ID_PREFIX}:accept:${inv._id.toString()}`;
        const denyId = `${CUSTOM_ID_PREFIX}:deny:${inv._id.toString()}`;

        const embed = new EmbedBuilder()
          .setTitle("UNO Team Invite")
          .setDescription(`${userMention(inviterId)} invited you to join their UNO team.`)
          .setFooter({ text: "You can accept or deny below." });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(acceptId).setLabel("Accept").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(denyId).setLabel("Deny").setStyle(ButtonStyle.Danger)
        );

        try {
          const user = await message.client.users.fetch(inviteeId);
          await user.send({ embeds: [embed], components: [row] });
          await message.reply(
            `Invite sent to ${userMention(inviteeId)}. If their DMs are closed, they can run \`uno accept @${message.author.username}\`.`
          );
        } catch {
          await message.reply(
            `${userMention(inviteeId)} has DMs off. They can accept using: \`uno accept @${message.author.username}\`.`
          );
        }
        return;
      }

      // accept
      if (sub === "accept") {
        const mention = args[1];
        if (!isUserMention(mention)) return void message.reply("Tag the inviter: `uno accept @inviter`");
        const inviterId = extractIdFromMention(mention)!;

        const tournament = await getOpenUnoTournament();

        const inv = await Invite.findOne({
          tournamentId: tournament._id,
          inviterId,
          inviteeId: message.author.id,
          status: "PENDING",
        });
        if (!inv) return void message.reply("No pending invite from that user.");

        const team = await Team.findById(inv.teamId);
        if (!team) {
          inv.status = "EXPIRED";
          await inv.save();
          return void message.reply("That team no longer exists.");
        }
        if (team.memberIds.length >= 2) {
          inv.status = "EXPIRED";
          await inv.save();
          return void message.reply("That team is already full.");
        }

        const inviteeExisting = await Team.findOne({
          tournamentId: tournament._id,
          memberIds: message.author.id,
          status: { $in: ["ACTIVE", "WAITLIST"] },
        }).lean();
        if (inviteeExisting) {
          inv.status = "DENIED";
          await inv.save();
          return void message.reply("You’re already on another team for this tournament.");
        }

        await TeamService.addMember(team._id, message.author.id);
        inv.status = "ACCEPTED";
        await inv.save();

        await message.reply(`You joined ${userMention(inviterId)}'s team!`);
        return;
      }

      // leave
      if (sub === "leave") {
        const tLocked = await Tournament.findOne({ status: { $in: ["LOCKED", "IN_PROGRESS"] } });
        if (tLocked) {
          return void message.reply("You can’t leave once the tournament is locked or active.");
        }

        const tournament = await Tournament.findOne({ status: { $in: ["REG_OPEN", "DRAFT"] } });
        if (!tournament) return void message.reply("No open UNO tournament found.");

        const team = await Team.findOne({
          tournamentId: tournament._id,
          memberIds: message.author.id,
          status: { $in: ["ACTIVE", "WAITLIST"] },
        });
        if (!team) return void message.reply("You’re not on a team for this tournament.");

        const wasActive = team.status === "ACTIVE";

        const updated = await TeamService.removeMember(team._id, message.author.id);

        if (wasActive && updated.memberIds.length < 2) {
          updated.status = "WAITLIST";
          await updated.save();
          await Tournament.updateOne(
            { _id: tournament._id },
            { $inc: { teamCount: -1, waitlistCount: 1 } }
          );
          await promoteNextWaitlistIfRoom(tournament._id);
        }

        await message.reply("You left your team.");
        return;
      }

      // teamname
      if (sub === "teamname") {
        const name = args.slice(1).join(" ").trim();
        if (!name) return void message.reply("Provide a team name: `uno teamname <name>`");

        const tournament = await getOpenUnoTournament();

        const team = await Team.findOne({
          tournamentId: tournament._id,
          memberIds: message.author.id,
          status: { $in: ["ACTIVE", "WAITLIST"] },
        });
        if (!team) return void message.reply("You’re not registered for this tournament.");

        if (team.memberIds.length !== 2) {
          return void message.reply("You can only set a team name once your team has exactly 2 members.");
        }

        await TeamService.setTeamName(team._id, name);
        await message.reply(`Team name set to **${name}**.`);
        return;
      }

      // fallback
      await message.reply("Unknown subcommand. Run `uno` for help.");
    } catch (error) {
      logger.error("UNO command error:", error);
      await message.reply("❌ An error occurred while processing your UNO command.");
    }
  },
} as Command;
