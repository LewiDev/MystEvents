import { Events, Interaction, CommandInteraction, AutocompleteInteraction, ChatInputCommandInteraction, ButtonInteraction, EmbedBuilder, ChannelType } from 'discord.js';
import { Event } from '../types';
import { logger } from '../utils/logger';
import { Collection } from 'discord.js';
import { OneKMem } from '../models/OneKMem';
import handleUnoInviteButtons from '../uno/services/unoInviteButtons';

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    try {
      if (interaction.isCommand()) {
        await handleCommand(interaction);
      } else if (interaction.isAutocomplete()) {
        await handleAutocomplete(interaction);
      } else if (interaction.isButton()) {
        await handleButton(interaction);
      }
    } catch (error) {
      logger.error('Error handling interaction:', error);
      
      const reply = {
        content: 'There was an error while executing this command!',
        ephemeral: true
      };
      
      if (interaction.isCommand()) {
        const cmdInteraction = interaction as CommandInteraction;
        if (cmdInteraction.replied || cmdInteraction.deferred) {
          await cmdInteraction.followUp(reply);
        } else {
          await cmdInteraction.reply(reply);
        }
      }
    }
  }
} as Event;

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  // ⬇️ NEW: Route UNO invite Accept/Deny buttons (prefix: "uno_invite")
  if (interaction.customId.startsWith('uno_invite:')) {
    await handleUnoInviteButtons(interaction);
    return;
  }

  if (interaction.customId === 'OneKMem') {
    await handleOneKMemStart(interaction);
  } else if (interaction.customId === 'hintButton') {
    await handleHintButton(interaction);
  }
}

async function handleOneKMemStart(interaction: ButtonInteraction): Promise<void> {
  let hasReplied = false;
  
  logger.info(`=== handleOneKMemStart called for user ${interaction.user.id} ===`);
  
  try {
    // Check if user has reacted with ✅ to the button's message
    const message = interaction.message;
    logger.info(`Starting reaction check for user ${interaction.user.id} on message ${message.id}`);
    
    // Try to get reaction from cache first
    let reaction = message.reactions.cache.get('✅');
    let userHasReacted = false;
    
    logger.info(`Initial reaction cache check: reaction=${!!reaction}, message.reactions.cache.size=${message.reactions.cache.size}`);
    
    // If reaction not in cache, try to fetch it
    if (!reaction) {
      try {
        logger.info(`Reaction not in cache for message ${message.id}, fetching fresh data...`);
        // Fetch the message to get fresh reaction data
        const freshMessage = await message.channel?.messages.fetch(message.id);
        if (freshMessage) {
          reaction = freshMessage.reactions.cache.get('✅');
          logger.info(`After fetching fresh message: reaction=${!!reaction}, freshMessage.reactions.cache.size=${freshMessage.reactions.cache.size}`);
        } else {
          logger.warn(`Failed to fetch fresh message for ${message.id}`);
        }
      } catch (error) {
        logger.error(`Error fetching message:`, error);
      }
    }
    
    // Check if user has reacted
    if (reaction && reaction.users.cache.has(interaction.user.id)) {
      userHasReacted = true;
      logger.info(`User ${interaction.user.id} reaction found in cache`);
    } else {
      logger.info(`User ${interaction.user.id} reaction not found in cache, reaction=${!!reaction}, users.cache.size=${reaction?.users.cache.size || 0}`);
      
      // Double-check by fetching the message again and checking reactions
      try {
        logger.info(`User ${interaction.user.id} reaction not found in cache, fetching fresh message...`);
        const freshMessage = await message.channel?.messages.fetch(message.id);
        if (freshMessage) {
          const freshReaction = freshMessage.reactions.cache.get('✅');
          logger.info(`Fresh message reaction: freshReaction=${!!freshReaction}, users.cache.size=${freshReaction?.users.cache.size || 0}`);
          
          if (freshReaction && freshReaction.users.cache.has(interaction.user.id)) {
            userHasReacted = true;
            logger.info(`User ${interaction.user.id} reaction found after fetching fresh message`);
          } else {
            logger.info(`User ${interaction.user.id} reaction still not found after fetching fresh message`);
          }
        } else {
          logger.warn(`Failed to fetch fresh message on second attempt for ${message.id}`);
        }
      } catch (error) {
        logger.error(`Error fetching fresh message:`, error);
      }
    }
    
    logger.info(`Final reaction check result: userHasReacted=${userHasReacted}`);
    
    // If user hasn't reacted, show error and return
    if (!userHasReacted) {
      logger.warn(`User ${interaction.user.id} has not reacted with ✅, showing error message`);
      hasReplied = true;
      await interaction.reply({
        content: 'You must react with ✅ to the event message before you can start.',
        ephemeral: true
      });
      return;
    }
    
    logger.info(`User ${interaction.user.id} reaction check passed, continuing with thread creation`);
    
    // Check if user already exists in the collection or is disqualified
    const existingUser = await OneKMem.findOne({ userId: interaction.user.id });
    if (existingUser) {
      // Check if user is disqualified
      if (existingUser.disqualified) {
        hasReplied = true;
        await interaction.reply({
          content: `❌ You have been disqualified from this event.\nReason: ${existingUser.dqReason || 'No reason provided'}`,
          ephemeral: true
        });
        return;
      }
      
      hasReplied = true;
      await interaction.reply({
        content: '❌ You have already started this event.',
        ephemeral: true
      });
      return;
    }
    
    // Check if user is already in the process of creating a thread (prevent double-clicking)
    if (!(global as any).creatingThreads) {
      (global as any).creatingThreads = {};
    }
    
    if (interaction.user.id in (global as any).creatingThreads) {
      hasReplied = true;
      await interaction.reply({
        content: '⏳ Please wait, your thread is being created...',
        ephemeral: true
      });
      return;
    }
    
    // Mark that this user is creating a thread
    (global as any).creatingThreads[interaction.user.id] = true;
    
    // Create thread channel
    if (!interaction.channel?.isThread() && 'threads' in interaction.channel!) {
      logger.info(`Starting thread creation for user ${interaction.user.id} in channel ${interaction.channel.id}`);
      
      // Create a private thread directly
      const thread = await (interaction.channel as any).threads.create({
        name: `eom - ${interaction.user.username}`,
        autoArchiveDuration: 1440,
        type: ChannelType.PrivateThread, // Private thread
        reason: 'echoes of mysthaven event thread'
      });
      
      logger.info(`Thread created successfully: ${thread.id}`);
      
      // Set thread permissions to not allow invites and add slowmode
      try {
        logger.info(`Setting thread permissions for ${thread.id}`);
        await thread.edit({
          invitable: false,
          rateLimitPerUser: 7200 // 5 second slowmode
        });
        logger.info(`Thread permissions set successfully for ${thread.id}`);
      } catch (error) {
        logger.error(`Error setting thread permissions:`, error);
        throw error;
      }
      
      // Create the OneKMem schema for the user
      logger.info(`Creating OneKMem data for user ${interaction.user.id}`);
      const currentTime = new Date();
      
      const oneKMemData = {
        userId: interaction.user.id,
        threadId: thread.id,
        startedEvent: currentTime,
        completedStages: [],
        currentStage: 1,
        pendingStageEmbeds: [],
        stage1: {
          startedAt: new Date(0), // Will be set by scheduler when stage 1 becomes active
          completedAt: new Date(0), // Not completed yet
        },
        stage2: {
          hint: "Hyrule",
          hintUsed: false,
          startedAt: new Date(0), // Will be set when stage 2 becomes active
          completedAt: new Date(0),
        },
        stage3: {
          hint: "Think of the song that introduces a world, a melody that sets the stage for adventure—a tune that could be called the \"identity\" of the realm itself.",
          hintUsed: false,
          startedAt: new Date(0),
          completedAt: new Date(0),
        },
        stage4: {
          hint: "The symbols speak in order; the first glance at each holds the secret you seek.",
          hintUsed: false,
          startedAt: new Date(0),
          completedAt: new Date(0),
        },
        stage5: {
          hint: "Pay attention to whats hidden in plain sight; they’ll guide your voice to the melody you seek. This answer is 4 words long",
          hintUsed: false,
          startedAt: new Date(0),
          completedAt: new Date(0),
        },
        stage6: {
          hint: "The Omnipotent mentions Earth's famed cuisine… recall the dish you glimpsed there first.",
          hintUsed: false,
          startedAt: new Date(0),
          completedAt: new Date(0),
        },
        stage7: {
          hintUsed: false,
          startedAt: new Date(0),
          completedAt: new Date(0),
        },
        stage8: {
          hint: "reply yes if you really want this hint.",
          hintUsed: false,
          startedAt: new Date(0),
          completedAt: new Date(0),
        },
        stage9: {
          hint: "A black hole spawned and swallowed your hint… unlucky",
          hintUsed: false,
          startedAt: new Date(0),
          completedAt: new Date(0),
        },
        stage10: {
          hintUsed: false,
          startedAt: new Date(0),
          completedAt: new Date(0),
        }
      };
      
      try {
        logger.info(`Saving OneKMem data to database for user ${interaction.user.id}`);
        const oneKMem = new OneKMem(oneKMemData);
        await oneKMem.save();
        logger.info(`OneKMem data saved successfully for user ${interaction.user.id}`);
      } catch (error) {
        logger.error(`Error saving OneKMem data:`, error);
        throw error;
      }
      
      // Send welcome message in the thread (without stage content)
      try {
        await thread.send({
          content: `Welcome ${interaction.user}!`,
          embeds: [new EmbedBuilder().setTitle("Echoes of Mysthaven").setDescription("Your event thread has been created! Stage 1 will begin automatically when the event starts.")]
        });
        logger.info(`Welcome message sent successfully to thread ${thread.id}`);
      } catch (error) {
        logger.error(`Error sending welcome message:`, error);
        throw error;
      }
      
      // Reply to the button interaction
      try {
        await interaction.reply({
          content: `✅ You have successfully created your Echoes of Mysthaven thread! Check your private thread: ${thread}`,
          ephemeral: true
        });
        logger.info(`Interaction reply sent successfully for user ${interaction.user.id}`);
      } catch (error) {
        logger.error(`Error sending interaction reply:`, error);
        throw error;
      }
      
      logger.info(`User ${interaction.user.tag} created Echoes of Mysthaven thread. Thread: ${thread.id}`);
      
      // Clean up the creating thread flag
      if ((global as any).creatingThreads && (global as any).creatingThreads[interaction.user.id]) {
        delete (global as any).creatingThreads[interaction.user.id];
      }
      
    } else {
      hasReplied = true;
      await interaction.reply({
        content: '❌ Cannot create thread in this channel. Please try in a text channel.',
        ephemeral: true
      });
    }
    
  } catch (error) {
    // Enhanced error logging to capture actual error details
    logger.error('Error starting OneKMem event:', {
      error: error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error type',
      errorStack: error instanceof Error ? error.stack : 'No stack trace',
      errorString: String(error),
      errorType: typeof error,
      userId: interaction.user.id,
      channelId: interaction.channel?.id,
      channelType: interaction.channel?.type
    });
    
    // Clean up the creating thread flag on error
    if ((global as any).creatingThreads && (global as any).creatingThreads[interaction.user.id]) {
      delete (global as any).creatingThreads[interaction.user.id];
    }
    
    // Only reply if the interaction hasn't been replied to yet
    if (!hasReplied && !interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: '❌ An error occurred while starting the event. Please try again.',
          ephemeral: true
        });
      } catch (replyError) {
        logger.error('Error sending error reply:', replyError);
      }
    }
  }
}

async function handleCommand(interaction: CommandInteraction): Promise<void> {
  const command = interaction.client.commands.get(interaction.commandName);
  
  if (!command) {
    logger.warn(`Command ${interaction.commandName} not found`);
    return;
  }
  
  // Check cooldown
  if (command.cooldown) {
    const { cooldowns } = interaction.client;
    const now = Date.now();
    const timestamps = cooldowns.get(interaction.commandName);
    const cooldownAmount = (command.cooldown || 3) * 1000;
    
    if (timestamps?.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id)! + cooldownAmount;
      
      if (now < expirationTime) {
        const expiredTimestamp = Math.round(expirationTime / 1000);
        await interaction.reply({
          content: `Please wait <t:${expiredTimestamp}:R> before using the \`${interaction.commandName}\` command again.`,
          ephemeral: true
        });
        return;
      }
    }
    
    if (!timestamps) {
      cooldowns.set(interaction.commandName, new Collection());
    }
    timestamps?.set(interaction.user.id, now);
    setTimeout(() => timestamps?.delete(interaction.user.id), cooldownAmount);
  }
  
  try {
    // Cast to ChatInputCommandInteraction for proper typing
    await command.execute(interaction as ChatInputCommandInteraction);
    logger.debug(`Command ${interaction.commandName} executed by ${interaction.user.tag}`);
  } catch (error) {
    logger.error(`Error executing command ${interaction.commandName}:`, error);
    
    const reply = {
      content: 'There was an error while executing this command!',
      ephemeral: true
    };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}

async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const command = interaction.client.commands.get(interaction.commandName);
  
  if (!command) {
    return;
  }
  
  try {
    // Handle autocomplete if the command supports it
    if ('autocomplete' in command && typeof command.autocomplete === 'function') {
      await command.autocomplete(interaction);
    }
  } catch (error) {
    logger.error(`Error handling autocomplete for command ${interaction.commandName}:`, error);
  }
}

async function handleHintButton(interaction: ButtonInteraction): Promise<void> {
  try {
    // Check if this is being used in a thread
    if (!interaction.channel?.isThread()) {
      await interaction.reply({
        content: '❌ This button can only be used in your event thread.',
        ephemeral: true
      });
      return;
    }
    
    const threadId = interaction.channel.id;
    const userId = interaction.user.id;
    
    // Find the user's OneKMem data
    const userData = await OneKMem.findOne({ userId, threadId });
    if (!userData) {
      await interaction.reply({
        content: '❌ You have not started this event yet.',
        ephemeral: true
      });
      return;
    }

    // Check if user is disqualified
    if (userData.disqualified) {
      await interaction.reply({
        content: `❌ You have been disqualified from this event.\nReason: ${userData.dqReason || 'No reason provided'}`,
        ephemeral: true
      });
      return;
    }
    
    // Check if the stage is active (user has completed previous stages AND stage is unlocked)
    const currentStage = userData.currentStage;
    const currentStageKey = `stage${currentStage}` as keyof typeof userData;
    const currentStageData = (userData as any)[currentStageKey];
    
    if (currentStage === 1) {
      // For stage 1, only check if the stage is unlocked by the scheduler
      if (!currentStageData.startedAt || currentStageData.startedAt.getTime() === 0) {
        await interaction.reply({
          content: `❌ Stage ${currentStage} has not been unlocked yet. You must wait for the stage to become active.`,
          ephemeral: true
        });
        return;
      }
    } else {
      // For other stages, check if previous stages are completed
      const requiredStages = Array.from({ length: currentStage - 1 }, (_, i) => i + 1);
      const hasCompletedPrevious = requiredStages.every(stage => userData.completedStages.includes(stage));
      
      if (!hasCompletedPrevious) {
        await interaction.reply({
          content: '❌ You must complete the previous stages before getting hints for this stage.',
          ephemeral: true
        });
        return;
      }
      
      // Check if the current stage is actually active (has been unlocked by the scheduler)
      if (!currentStageData.startedAt || currentStageData.startedAt.getTime() === 0) {
        await interaction.reply({
          content: `❌ Stage ${currentStage} has not been unlocked yet. You must wait for the stage to become active.`,
          ephemeral: true
        });
        return;
      }
    }
    
    // Check if this stage has a hint
    if (!currentStageData.hint) {
      await interaction.reply({
        content: 'There is no hint for this stage.',
        ephemeral: true
      });
      return;
    }
    
    // Check if they've already used a hint for this stage
    if (currentStageData.hintUsed) {
      await interaction.reply({
        content: '❌ You have already used a hint for this stage.',
        ephemeral: true
      });
      return;
    }
    
    // Refresh user data from database to get current hint status
    const freshUserData = await OneKMem.findOne({ userId, threadId });
    if (!freshUserData) {
      await interaction.reply({
        content: '❌ User data not found. Please try again.',
        ephemeral: true
      });
      return;
    }
    
    // Count total hints used across all stages (only count stages that actually have hints)
    // Use a more direct approach to avoid potential type issues
    let totalHintsUsed = 0;
    for (let i = 1; i <= 10; i++) {
      const stageKey = `stage${i}` as keyof typeof freshUserData;
      const stageData = (freshUserData as any)[stageKey];
      if (stageData?.hint && stageData?.hintUsed) {
        totalHintsUsed++;
      }
    }
    
    // Debug logging - show all stage hint status
    logger.info(`User ${interaction.user.tag} requesting hint for stage ${currentStage}. Current hints used: ${totalHintsUsed}/3`);
    logger.info(`Stage hint status for user ${interaction.user.tag}:`);
    for (let i = 1; i <= 10; i++) {
      const stageKey = `stage${i}` as keyof typeof freshUserData;
      const stageData = (freshUserData as any)[stageKey];
      if (stageData?.hint) {
        logger.info(`  Stage ${i}: hint="${stageData.hint}", hintUsed=${stageData.hintUsed}`);
      }
    }
    
    // Check if they've used all 3 hints
    if (totalHintsUsed >= 3) {
      logger.info(`User ${interaction.user.tag} has already used all 3 hints. Denying hint request.`);
      await interaction.reply({
        content: '❌ You have used all 3 hints available for this event.',
        ephemeral: true
      });
      return;
    }
    
    // Mark the hint as used
    currentStageData.hintUsed = true;
    
    // Count hints AFTER marking this one as used
    const newTotalHintsUsed = totalHintsUsed + 1;
    
    logger.info(`Marking hint as used for user ${interaction.user.tag} on stage ${currentStage}. New total: ${newTotalHintsUsed}/3`);
    
    await userData.save();
    
    // Send the hint
    const hintEmbed = new EmbedBuilder()
      .setDescription(currentStageData.hint)
      .setFooter({ text: `Hints used: ${newTotalHintsUsed}/3` })

    
    await interaction.reply({
      content: "↘",
      embeds: [hintEmbed],

    });
    
    logger.info(`User ${interaction.user.tag} used hint for stage ${currentStage}`);
    
  } catch (error) {
    logger.error('Error getting hint:', error);
    
    // Only reply if the interaction hasn't been replied to yet
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ An error occurred while getting the hint. Please try again.',
        ephemeral: true
      });
    }
  }
}
