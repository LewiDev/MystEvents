import { Message, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { OneKMem } from '../../models/OneKMem';

export default {
  name: 'setstage',
  description: 'Set a user\'s current stage',
  aliases: ['setstage', 'stageuser'],
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
        await message.reply('❌ Please specify a user and stage number.\nUsage: `!setstage @user <stage>` or `!setstage <userId> <stage>`');
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

      const stageNumber = parseInt(args[1]);
      if (isNaN(stageNumber) || stageNumber < 1 || stageNumber > 10) {
        await message.reply('❌ Please specify a valid stage number between 1 and 10.');
        return;
      }

      // Find the user's event data
      const userData = await OneKMem.findOne({ userId });
      if (!userData) {
        await message.reply('❌ This user has not started the event yet.');
        return;
      }

      // Update the user's current stage
      userData.currentStage = stageNumber;
      await userData.save();

      const embed = new EmbedBuilder()
        .setTitle('✅ Stage Updated')
        .setDescription(`Successfully set <@${userId}> to **Stage ${stageNumber}**`)
        .setColor(0x00ff00)
        .setTimestamp();

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error setting stage:', error);
      await message.reply('❌ An error occurred while setting the stage.');
    }
  }
} as Command;
