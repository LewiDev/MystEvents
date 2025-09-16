import { logger } from './logger';
import { checkAndActivateStages } from './stageProgression';
import { OneKMem, IOneKMem } from '../models/OneKMem';
import { getStageDescription, isStageActive, getStageDifficulty } from './stageProgression';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder } from 'discord.js';

let stageCheckInterval: NodeJS.Timeout | null = null;
let discordClient: Client | null = null;

export function startStageScheduler(client: Client): void {
  discordClient = client;
  try {
    // Check stages every minute for precise timing
    stageCheckInterval = setInterval(async () => {
      await checkAndActivateStages();
      await sendStageEmbedsToEligibleUsers();
    }, 60 * 1000); // 1 minute
    
    // Also run immediately on startup
    setTimeout(async () => {
      await checkAndActivateStages();
      await sendStageEmbedsToEligibleUsers();
    }, 5000); // 5 seconds after startup
    
    logger.info('Stage scheduler started');
  } catch (error) {
    logger.error('Error starting stage scheduler:', error);
  }
}

export function stopStageScheduler(): void {
  if (stageCheckInterval) {
    clearInterval(stageCheckInterval);
    stageCheckInterval = null;
    logger.info('Stage scheduler stopped');
  }
}

let hintButton = new ButtonBuilder()
  .setCustomId('hintButton')
  .setLabel('HINT')
  .setStyle(ButtonStyle.Secondary);

let hintButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(hintButton);

async function sendStageEmbedsToEligibleUsers(): Promise<void> {
  try {
    if (!discordClient) {
      logger.warn('Discord client not available for sending stage embeds');
      return;
    }

    // Check each stage from 1 to 10 (now including stage 1)
    for (let stageNumber = 1; stageNumber <= 10; stageNumber++) {
      if (!isStageActive(stageNumber)) continue;
      
      const stageDescription = getStageDescription(stageNumber);
      if (!stageDescription) continue;
      
      // Find users who have pending embeds for this stage
      const usersToNotify = await OneKMem.find({
        pendingStageEmbeds: { $in: [stageNumber] }
      });
      
      if (usersToNotify.length === 0) continue;
      
      logger.info(`Sending stage ${stageNumber} embeds to ${usersToNotify.length} users`);
      
      // Send embeds to all eligible users
      for (const user of usersToNotify) {
        try {
          const channel = await discordClient.channels.fetch(user.threadId);
          
          if (channel?.isThread()) {
            const stageEmbed = new EmbedBuilder()
              .setTitle(`STAGE ${stageNumber}/10`)
              .setDescription(`-# Difficulty: ${getStageDifficulty(stageNumber)}\n\n${stageDescription}`)

            
            await channel.send({ content: `<@${user.userId}>`, embeds: [stageEmbed], components: [hintButtonRow] });
            
            // Remove this stage from pending embeds
            user.pendingStageEmbeds = user.pendingStageEmbeds?.filter(s => s !== stageNumber) || [];
            await user.save();
            
            logger.info(`Sent stage ${stageNumber} embed to user ${user.userId} in thread ${user.threadId}`);
          }
        } catch (error) {
          logger.error(`Error sending stage ${stageNumber} embed to user ${user.userId}:`, error);
        }
      }
    }
  } catch (error) {
    logger.error('Error sending stage embeds:', error);
  }
}


