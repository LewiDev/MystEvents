// src/events/interactionCreate/unoInviteButtons.ts
import { ButtonInteraction, userMention } from "discord.js";
import { Invite } from "../../models/uno/invite";
import { Team } from "../../models/uno/team";
import { TeamService } from "../../uno/services/teamService";
import { Tournament } from "../../models/uno/tournament";

const PREFIX = "uno_invite";

export default async function handleUnoInviteButtons(interaction: ButtonInteraction) {
  if (!interaction.isButton()) return;
  const [prefix, action, inviteId] = interaction.customId.split(":");
  if (prefix !== PREFIX) return;

  await interaction.deferUpdate(); // silent ack

  const inv = await Invite.findById(inviteId);
  if (!inv || inv.status !== "PENDING") return;

  // Only the invitee can press the buttons
  if (interaction.user.id !== inv.inviteeId) return;

  const tournament = await Tournament.findById(inv.tournamentId);
  if (!tournament || tournament.status !== "REG_OPEN") {
    inv.status = "EXPIRED"; await inv.save();
    return;
  }

  if (action === "deny") {
    inv.status = "DENIED";
    await inv.save();
    try { await interaction.editReply({ content: "Invite denied.", components: [] }); } catch {}
    return;
  }

  if (action === "accept") {
    const team = await Team.findById(inv.teamId);
    if (!team) {
      inv.status = "EXPIRED"; await inv.save();
      return;
    }
    if (team.memberIds.length >= 2) {
      inv.status = "EXPIRED"; await inv.save();
      return;
    }

    // Ensure user not already in another team
    const already = await Team.findOne({
      tournamentId: tournament._id,
      memberIds: inv.inviteeId,
      status: { $in: ["ACTIVE", "WAITLIST"] },
    }).lean();
    if (already) {
      inv.status = "DENIED"; await inv.save();
      try { await interaction.followUp({ content: "You’re already on another team for this tournament.", ephemeral: true }); } catch {}
      return;
    }

    await TeamService.addMember(team._id, inv.inviteeId);
    inv.status = "ACCEPTED";
    await inv.save();

    // Confirm in DM
    try {
      await interaction.followUp({
        content: `You joined ${userMention(inv.inviterId)}'s team!`,
        ephemeral: true,
      });
    } catch {}
    return;
  }
}
