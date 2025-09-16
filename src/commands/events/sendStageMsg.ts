import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../types';
import { getStageDescription } from '../../utils/stageProgression';

export default {
  name: 'sendstagemsg',
  description: 'Send a stage message with hint button',
  aliases: ['stage', 'sendstage'],
  cooldown: 0,
  isMessageCommand: true,
  
  async execute(message: Message, args?: string[]) {
    try {
      // Check if user has permission (you can modify this check)
      if (!message.member?.permissions.has('Administrator')) {
        await message.reply('❌ You do not have permission to use this command.');
        return;
      }

      if (!args || args.length === 0) {
        await message.reply('❌ Please specify a stage number (1-10).\nUsage: `!sendstagemsg <stage>`');
        return;
      }

      const stageNumber = parseInt(args[0]);
      if (isNaN(stageNumber) || stageNumber < 1 || stageNumber > 10) {
        await message.reply('❌ Please specify a valid stage number between 1 and 10.');
        return;
      }

      // Get the actual stage content from the stage progression system
      const stageDescription = getStageDescription(stageNumber);
      const stageDifficulty = getStageDifficultyLocal(stageNumber);

      if (!stageDescription) {
        await message.reply('❌ Stage content not found for this stage.');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`STAGE ${stageNumber}/10`)
        .setDescription(`-# Difficulty: ${stageDifficulty}\n\n${stageDescription}`);

      const button = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('hintButton')
            .setLabel('HINT')
            .setStyle(ButtonStyle.Secondary)
        );

      await message.reply({
        content: "↘",
        embeds: [embed],
        components: [button]
      });

    } catch (error) {
      console.error('Error sending stage message:', error);
      await message.reply('❌ An error occurred while sending the stage message.');
    }
  }
} as Command;

// Local function to get stage difficulty
function getStageDifficultyLocal(stageNumber: number): string {
  switch (stageNumber) {
    case 1: return "EASY";
    case 2: return "MEDIUM";
    case 3: return "MEDIUM";
    case 4: return "EASY";
    case 5: return "MEDIUM";
    case 6: return "MEDIUM";
    case 7: return "EASY";
    case 8: return "MEDIUM";
    case 9: return "HARD";
    case 10: return "EASY";
    default: return "UNKNOWN";
  }
}
