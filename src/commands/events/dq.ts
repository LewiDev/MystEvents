import { Message, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { OneKMem } from '../../models/OneKMem';

export default {
  name: 'dq',
  description: 'Disqualify a user from the event',
  aliases: ['disqualify', 'remove'],
  cooldown: 0,
  isMessageCommand: true,
  
  async execute(message: Message, args?: string[]) {
    try {
      // Check if user has permission (you can modify this check)
      if (!message.member?.permissions.has('Administrator')) {
        await message.reply('❌ You do not have permission to use this command.');
        return;
      }

      if (!args || args.length < 2) {
        await message.reply('❌ Please specify a user and reason.\nUsage: `!dq @user <reason>` or `!dq <userId> <reason>`');
        return;
      }

      // Extract user ID from mention or direct ID
      let userId = args[0];
      if (userId.startsWith('<@') && userId.endsWith('>')) {
        // Remove <@ and > and check if it's a user or role
        userId = userId.slice(2, -1);
        if (userId.startsWith('!')) {
          userId = userId.slice(1); // Remove the ! for user mentions
        }
      }

      // Validate user ID format
      if (!/^\d+$/.test(userId)) {
        await message.reply('❌ Please provide a valid user mention or user ID.');
        return;
      }

      // Get the reason (everything after the user ID)
      const reason = args.slice(1).join(' ');

      // Find the user's event data
      const userData = await OneKMem.findOne({ userId });
      if (!userData) {
        await message.reply('❌ This user has not started the event yet.');
        return;
      }

      // Check if user is already disqualified
      if (userData.disqualified) {
        await message.reply('❌ This user is already disqualified from the event.');
        return;
      }

      // Disqualify the user
      userData.disqualified = true;
      userData.dqReason = reason;
      userData.dqDate = new Date();
      await userData.save();

      const embed = new EmbedBuilder()
        .setTitle('🚫 User Disqualified')
        .setDescription(`<@${userId}> has been disqualified from the event.`)
        .addFields(
          { name: 'Reason', value: reason, inline: false },
          { name: 'Disqualified At', value: userData.dqDate.toLocaleString(), inline: true },
          { name: 'Previous Stage', value: `Stage ${userData.currentStage}`, inline: true }
        )
        .setColor(0xff0000)
        .setTimestamp();

      await message.reply({ embeds: [embed] });

      // Log the disqualification
      console.log(`User ${userId} disqualified from event. Reason: ${reason}. Moderator: ${message.author.tag}`);

    } catch (error) {
      console.error('Error disqualifying user:', error);
      await message.reply('❌ An error occurred while disqualifying the user.');
    }
  }
} as Command;
