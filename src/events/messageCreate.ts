import { Events, Message, Collection, ButtonStyle, ButtonBuilder, ActionRowBuilder, TextChannel } from 'discord.js';
import { Event } from '../types';
import { logger } from '../utils/logger';
import { OneKMem } from '../models/OneKMem';
import { EmbedBuilder } from 'discord.js';
import { getStageActivationTime } from '../utils/stageProgression';

export default {
  name: Events.MessageCreate,
  async execute(message: Message) {
    try {
      // Ignore bot messages
      if (message.author.bot) return;
      
      // Check if this is a command
      const prefix = process.env.BOT_PREFIX || '!';
      if (message.content.startsWith(prefix)) {
        await handleCommand(message);
        return;
      }
      
      // Check for OneKMem stage completion
      await handleOneKMemStageCompletion(message);
      
    } catch (error) {
      logger.error('Error handling message:', error);
    }
  }
} as Event;

async function handleCommand(message: Message) {
  let commandName: string | undefined;
  
  try {
    const prefix = process.env.BOT_PREFIX || '!';
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    commandName = args.shift()?.toLowerCase();
    
    if (!commandName) return;
    
    let command = message.client.commands.get(commandName);
    
    if (!command) {
      command = message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName!));
    }
    
    if (!command) return;
    
    // Check if command supports message execution
    if (!command.isMessageCommand) {
      await message.reply('❌ This command can only be used as a slash command.');
      return;
    }
    
    // Check cooldown
    if (command.cooldown) {
      const { cooldowns } = message.client;
      const now = Date.now();
      const timestamps = cooldowns.get(commandName);
      const cooldownAmount = (command.cooldown || 3) * 1000;
      
      if (timestamps?.has(message.author.id)) {
        const expirationTime = timestamps.get(message.author.id)! + cooldownAmount;
        
        if (now < expirationTime) {
          const expiredTimestamp = Math.round(expirationTime / 1000);
          await message.reply(`Please wait <t:${expiredTimestamp}:R> before using the \`${commandName}\` command again.`);
          return;
        }
      }
      
      if (!timestamps) {
        cooldowns.set(commandName, new Collection());
      }
      timestamps?.set(message.author.id, now);
      setTimeout(() => timestamps?.delete(message.author.id), cooldownAmount);
    }
    
    // Execute command
    await command.execute(message, args);
    logger.debug(`Command ${commandName} executed by ${message.author.tag}`);
    
  } catch (error) {
    logger.error(`Error executing command ${commandName || 'unknown'}:`, error);
    await message.reply('❌ There was an error while executing this command!');
  }
}

let hintButton = new ButtonBuilder()
  .setCustomId('hintButton')
  .setLabel('HINT')
  .setStyle(ButtonStyle.Secondary);

let hintButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(hintButton);

async function handleOneKMemStageCompletion(message: Message) {
  try {
    // Only check in threads
    if (!message.channel?.isThread()) return;
    
    const threadId = message.channel.id;
    const userId = message.author.id;
    
    // Find the user's OneKMem data
    const userData = await OneKMem.findOne({ userId, threadId });
    if (!userData) return;

    // Check if user is disqualified
    if (userData.disqualified) return;
    

    
    // Check for stage 1 completion
    if (userData.currentStage === 1 && !userData.completedStages.includes(1)) {
      const messageContent = message.content.toLowerCase().trim();
      
      if (messageContent === 'whispering glade') {
        await completeStage1(userData, message);
      }
    } else if (userData.currentStage === 2 && !userData.completedStages.includes(2)) {
      const messageContent = message.content.toLowerCase().trim();
      
      if (messageContent === 'korok') {
        await completeStage2(userData, message);
      }
    } else if (userData.currentStage === 3 && !userData.completedStages.includes(3)) {
      const messageContent = message.content.toLowerCase().trim();
      
      if (messageContent === 'title theme') {
        await completeStage3(userData, message);
      }
    } else if (userData.currentStage === 4 && !userData.completedStages.includes(4)) {
      const messageContent = message.content.toLowerCase().trim();
      
      if (messageContent === 'realm') {
        await completeStage4(userData, message);
      }
    } else if (userData.currentStage === 5 && !userData.completedStages.includes(5)) {
      const messageContent = message.content.toLowerCase().trim();
      
      if (messageContent === 'clouds have gone by') {
        await completeStage5(userData, message);
      }
    } else if (userData.currentStage === 6 && !userData.completedStages.includes(6)) {
      const messageContent = message.content.toLowerCase().trim();
      
      if (messageContent === 'burger') {
        await completeStage6(userData, message);
      }
    } else if (userData.currentStage === 7 && !userData.completedStages.includes(7)) {
      const messageContent = message.content.toLowerCase().trim();
      
      if (messageContent === 'wildheart wildheart wildheart') {
        await completeStage7(userData, message);
      }
    } else if (userData.currentStage === 8 && !userData.completedStages.includes(8)) {
      const messageContent = message.content.toLowerCase().trim();
      
      if (messageContent === 'time potion') {
        await completeStage8(userData, message);
      }
      if (messageContent === 'yes') {
        message.reply("your cooldown has gone back to 2 hours lol.");
      }
    } else if (userData.currentStage === 9 && !userData.completedStages.includes(9)) {
      const messageContent = message.content.toLowerCase().trim();
      
      if (messageContent === message.member?.user.username) {
        await completeStage9(userData, message);
      }
    } else if (userData.currentStage === 10 && !userData.completedStages.includes(10)) {
      const messageContent = message.content.toLowerCase().trim();
      
      if (messageContent === 'congratulations') {
        await completeStage10(userData, message);
      }
    } else if (userData.currentStage === 10 && userData.completedStages.includes(10)) {
      const messageContent = message.content.toLowerCase().trim();
      
      if (messageContent === 'headphones') {
        await completeBonusPrize(userData, message);
      }
    }
  } catch (error) {
    logger.error('Error handling OneKMem stage completion:', error);
  }
}



async function completeStage1(userData: any, message: Message) {
  try {
    const currentTime = new Date();
    
    // Mark stage 1 as completed
    userData.stage1.completedAt = currentTime;
    userData.completedStages.push(1);
    userData.currentStage = 2;
    
    // Save the stage completion immediately
    await userData.save();
    
    // Set stage 2 startedAt if stage 2 is already active
    const stage2ActivationTime = getStageActivationTime(2); // Tuesday 26th Aug 13:00 UTC 2025-08-26T13:00:00.000Z
    if (currentTime >= stage2ActivationTime!) {
      userData.stage2.startedAt = currentTime;
      
      const completionEmbed = new EmbedBuilder()
      .setDescription('You have successfully completed Stage 1!')

    
      if (message.channel?.isThread() && message.channel.id === userData.threadId) {
        await (message.channel as any).send({ content: `↘`, embeds: [completionEmbed] });
      }

      // Send stage 2 content immediately
      const stage2Embed = new EmbedBuilder()
        .setTitle("STAGE 2/10")
        .setDescription("-# Difficulty: MEDIUM\n\nYou summon a portal after voicing the name the Sovereigns left behind. A world unfamiliar—a world that was once at peace, now ruled by the Demon Lord—unfolds beyond the hazy purple gates. Strange creatures appear, ones you first mistake for leaves carried by the wind's breeze. They dance and frolic in the overgrown grass. You ask what they are, but The System turns to static, leaving the word unknown.\n\nOne of them leaps forward, a childlike forest spirit with a mischievous grin, jumping and screeching in a high-pitched tone. This world feels so strange, and you can't help but laugh—wondering what, exactly, this creature could be.")
      
      if (message.channel?.isThread()) {
        await (message.channel as any).send({content: `<@${userData.userId}>`, embeds: [stage2Embed], components: [hintButtonRow] });
      }
      
      // Save the stage2 startedAt
      await userData.save();
    }
    
    logger.info(`User ${message.author.tag} completed stage 1 in thread ${message.channel.id}`);
    
  } catch (error) {
    logger.error('Error completing stage 1:', error);
  }
}

async function completeStage2(userData: any, message: Message) {
  try {
    const currentTime = new Date();
    
    // Mark stage 2 as completed
    userData.stage2.completedAt = currentTime;
    userData.completedStages.push(2);
    userData.currentStage = 3;
    
    // Save the stage completion immediately
    await userData.save();
    
    // Set stage 3 startedAt if stage 3 is already active
    const stage3ActivationTime = getStageActivationTime(3); // Tuesday 27th Aug 13:00 UTC
    if (currentTime >= stage3ActivationTime!) {
      userData.stage3.startedAt = currentTime;
      
          // Send completion message
        const completionEmbed = new EmbedBuilder()
        .setDescription('You have successfully completed Stage 2!')

      
      if (message.channel?.isThread() && message.channel.id === userData.threadId) {
        await (message.channel as any).send({ embeds: [completionEmbed]  });
      }

      // Send stage 3 content immediately
      const stage3Embed = new EmbedBuilder()
        .setTitle("STAGE 3/10")
        .setDescription("-# Difficulty: MEDIUM\n\nKorok! You remembered! The tiny creature approaches, handing you a device that looks even more futuristic than the arcane energy stones of Mysthaven. Without warning, the Korok shoves it onto your head and over your ears.\n\n*\"Erm… Korok… why do these have bunny ears?\"* you ask.\n\nThe Korok says nothing. It only stares—judging you silently. Its leafy face twists into an angry little scowl as you meet its gaze. Then, suddenly, you hear it: a rhythm softly flowing into your ears. It’s heavenly—so serene you can almost see yourself wandering through the Whispering Glade.\n\nYou turn to the Korok again. *\“What is the name of this peaceful tune?\”* you ask.\n\nThe Korok only squeals.\n\nYour hand curls into a fist. *\“I must know the name of this song!\”* you shout.")
      
      if (message.channel?.isThread()) {
        await (message.channel as any).send({ content: `<@${userData.userId}>`, embeds: [stage3Embed], components: [hintButtonRow]  });
      }
      
      // Save the stage3 startedAt
      await userData.save();
    }
    
    logger.info(`User ${message.author.tag} completed stage 2 in thread ${message.channel.id}`);
    
  } catch (error) {
    logger.error('Error completing stage 2:', error);
  }
}

async function completeStage3(userData: any, message: Message) {
  try {
    const currentTime = new Date();
    
    // Mark stage 3 as completed
    userData.stage3.completedAt = currentTime;
    userData.completedStages.push(3);
    userData.currentStage = 4;
    
    // Save the stage completion immediately
    await userData.save();
    
    // Set stage 4 startedAt if stage 4 is already active
    const stage4ActivationTime = getStageActivationTime(4); // Tuesday 28th Aug 13:00 UTC
    if (currentTime >= stage4ActivationTime!) {
      userData.stage4.startedAt = currentTime;
      
    // Send completion message
    const completionEmbed = new EmbedBuilder()
      .setDescription('You have successfully completed Stage 3!')

    
    if (message.channel?.isThread() && message.channel.id === userData.threadId) {
      await (message.channel as any).send({ content: "↘", embeds: [completionEmbed] });
    }

      // Send stage 4 content immediately
      const stage4Embed = new EmbedBuilder()
        .setTitle("STAGE 4/10") 
        .setDescription("-# Difficulty: EASY\n\nAs the final note of the song fades, the portal begins to collapse, the purple haze drawing shut like a curtain. The Korok squeals one last time before vanishing into the wind, leaving you utterly alone.\n\nYou tug at the strange headphones still wrapped around your ears—only to realize they remain, pulsing faintly with arcane energy.\n\nWhen you whisper the song\’s name, the headphones tremble. A spark of light shoots forth, carving a single glowing code into the soil before you...\n\n🔴 🦅 🍎 🪜 🌙")      
      if (message.channel?.isThread()) {
        await (message.channel as any).send({ content: `<@${userData.userId}>`, embeds: [stage4Embed], components: [hintButtonRow]  });
      }
      
      // Save the stage4 startedAt
      await userData.save();
    }
    
    logger.info(`User ${message.author.tag} completed stage 3 in thread ${message.channel.id}`);
    
  } catch (error) {
    logger.error('Error completing stage 3:', error);
  }
}

async function completeStage4(userData: any, message: Message) {
  try {
    const currentTime = new Date();
    
    // Mark stage 4 as completed
    userData.stage4.completedAt = currentTime;
    userData.completedStages.push(4);
    userData.currentStage = 5;
    
    // Save the stage completion immediately
    await userData.save();
    
    // Set stage 5 startedAt if stage 5 is already active
    const stage5ActivationTime = getStageActivationTime(5); // Friday 29th Aug 13:00 UTC
    if (currentTime >= stage5ActivationTime!) {
      userData.stage5.startedAt = currentTime;
      
    // Send completion message
    const completionEmbed = new EmbedBuilder()
      .setDescription('You have successfully completed Stage 4!')
    
    if (message.channel?.isThread() && message.channel.id === userData.threadId) {
      await (message.channel as any).send({ content: "↘", embeds: [completionEmbed] });
    }

      // Send stage 5 content immediately
      const stage5Embed = new EmbedBuilder()
        .setTitle("STAGE 5/10")
        .setDescription("-# Difficulty: MEDIUM\n\nYou suddenly teleport to a new realm?! Strange devices with wheels roll past you at dizzying speeds, leaving you bewildered by the view that unfolds. Determined to explore, you take a stroll through this bizarre world—one so vastly different from the lands you know.\n\nYou see taverns, farmer's markets, gold stores… yet something feels wrong. Everything looks strange. *What is a McDonald's?*\n\nAs you regain your composure, your steps slow before an esoteric shop, its window glimmering with items that feel oddly familiar. Suddenly, static crackles from the device the Korok forced upon your head. You push the door open, and the noise ceases. The sign above reads: **Trinity of 26 Stars**.\n\nA haunting tune begins to play. You glance at the wall and see a moving painting—its figures shifting in rhythm with the sound. Below it, a label reads: \"The Wizard — Black Sabbath.\"\n\nConfused, you whisper: *\"What realm offers such torment so freely to its people?\"*\n\nBut as the melody flows, something changes. The rhythm takes hold of you, and before long, you find yourself singing along. Then, one lyric strikes you—it feels as though it was written for you alone.")
      
      if (message.channel?.isThread()) {
        await (message.channel as any).send({ content: `<@${userData.userId}>`, embeds: [stage5Embed], components: [hintButtonRow]  });
      }
      
      // Save the stage5 startedAt
      await userData.save();
    }
    
    logger.info(`User ${message.author.tag} completed stage 4 in thread ${message.channel.id}`);
    
  } catch (error) {
    logger.error('Error completing stage 4:', error);
  }
}

async function completeStage5(userData: any, message: Message) {
  try {
    const currentTime = new Date();
    
    // Mark stage 5 as completed
    userData.stage5.completedAt = currentTime;
    userData.completedStages.push(5);
    userData.currentStage = 6;
    
    // Save the stage completion immediately
    await userData.save();
    
    // Set stage 6 startedAt if stage 6 is already active
    const stage6ActivationTime = getStageActivationTime(6); // Saturday 30th Aug 13:00 UTC
    if (currentTime >= stage6ActivationTime!) {
      userData.stage6.startedAt = currentTime;
      

          // Send completion message
    const completionEmbed = new EmbedBuilder()
    .setDescription('You have successfully completed Stage 5!')
  
  if (message.channel?.isThread() && message.channel.id === userData.threadId) {
    await (message.channel as any).send({ content: "↘", embeds: [completionEmbed] });
  }

      // Send stage 6 content immediately
      const stage6Embed = new EmbedBuilder()
        .setTitle("STAGE 6/10")
        .setDescription("-# Difficulty: MEDIUM\n\nYou blink—and you're back in Mysthaven. Even more confused than before, the memory of those strange taverns in the other realm lingers, leaving you parched. You stumble into the nearest tavern and collapse into a chair, letting the weight of the day slip away.\n\nHours pass in a haze. When you finally stagger out the door, dawn greets you with its golden glow. The sun is rising. You squint at the sky, muttering to yourself, *\"What time is it?\"*\n\nThe clouds drift lazily overhead… all but one. This one moves differently—faster, deliberate. Before you can react, it rushes toward you. A weapon is drawn—ready to strike—only for the cloud to screech to a halt and… honk?\n\n*\"What on earth is going on?\"* you whisper. At this point, nothing surprises you anymore. You shake your head, yearning for the comfort of a bed, and begin the slow trek back to Moonveil.\n\nBut fate has other plans. Your foot catches on a rock, and you crash forward. The ground feels soft—far too soft. *\"Is this… heaven?\"* you mumble.\n\nNo. You're on the cloud.\n\nBefore you can process this, the cloud zooms off, carrying you higher and higher. Panic seizes you as the ground fades, the sun blazing ever closer. *\"I can't breathe!\"* you cry out.\n\nThen you see it: an angelic figure ahead—faceless, featureless, a being of pure white light with wings that stretch across eternity.\n\n*\"Don't worry,\"* it says. *\"You are not dying. Welcome to the Realm of the Rulers. I am the Omnipotent.\"*\n\nYour mind spins. Are you dreaming? Drunk? Both? Still, you listen as the Omnipotent speaks—its voice like rolling thunder and soft rain. It tells you of another realm called Earth, a place with wonders beyond imagining: strange things named *Valorant* and *The Smiths*, and above all… food. So much food.\n\nThe Omnipotent laughs heartily at your ignorance, teasing you for never tasting Earth's legendary cuisine. Then, leaning close, it begins to tell a story—of a dish so exquisite, so divine, it humbled even a being like itself during a visit to that distant realm…")
      
      if (message.channel?.isThread()) {
        await (message.channel as any).send({ content: `<@${userData.userId}>`, embeds: [stage6Embed], components: [hintButtonRow]  });
      }
      
      // Save the stage6 startedAt
      await userData.save();
    }
    
    logger.info(`User ${message.author.tag} completed stage 5 in thread ${message.channel.id}`);
    
  } catch (error) {
    logger.error('Error completing stage 5:', error);
  }
}

async function completeStage6(userData: any, message: Message) {
  try {
    const currentTime = new Date();
    
    // Mark stage 6 as completed
    userData.stage6.completedAt = currentTime;
    userData.completedStages.push(6);
    userData.currentStage = 7;
    
    // Save the stage completion immediately
    await userData.save();
    
    // Set stage 7 startedAt if stage 7 is already active
    const stage7ActivationTime = getStageActivationTime(7); // Sunday 31st Aug 13:00 UTC
    if (currentTime >= stage7ActivationTime!) {
      userData.stage7.startedAt = currentTime;
      
    // Send completion message
    const completionEmbed = new EmbedBuilder()
      .setDescription('You have successfully completed Stage 6!')
    
    if (message.channel?.isThread() && message.channel.id === userData.threadId) {
      await (message.channel as any).send({ content: "↘", embeds: [completionEmbed] });
    }

      // Send stage 7 content immediately
      const stage7Embed = new EmbedBuilder()
        .setTitle("STAGE 7/10")
        .setDescription("-# Difficulty: EASY\n\nThe Omnipotent recalls the dish and forms a recipe from the taste it once remembered. It hands you the recipe for your enjoyment, and you begin to wonder how you even arrived at this point. You ask yourself, *\"How does this relate to the quest?\"* Determined to find out, you form a plan: you will create this dish for the Omnipotent and hope it answers your question.\n\nYou request a kitchen, and the Omnipotent kindly guides you to the chef's area. You begin to craft this unfamiliar item, recalling a vague memory of seeing it through a \"mcdoodles?\" you murmur.\n\nOnce finished, you offer the dish to the Omnipotent. The fresh aroma of onion, meat, and toasted bread combined makes even your mouth water. The Omnipotent is visibly overjoyed by your consideration and grants you newfound strength for your quest.\n\nYou ask if it knows of the hidden treasure left in the Whispering Glade. The Omnipotent pauses, recalling that it was left by a sovereign. It explains that the sovereign has now fallen and resides deep within the forests of Mysthaven, holding all the information you need — but urges you to exercise caution should you visit.\n\nAs you prepare to hop onto the cloud, the Omnipotent offers a helpful hint about the sovereign's name: *\"The name is one word, though it carries two ideas within it: the untamed spirit and the heart of life itself. Speak it three times, and the dungeon will appear before you.\"*")
      
      if (message.channel?.isThread()) {
        await (message.channel as any).send({ content: `<@${userData.userId}>`, embeds: [stage7Embed], components: [hintButtonRow]  });
      }
      
      // Save the stage7 startedAt
      await userData.save();
    }
    
    logger.info(`User ${message.author.tag} completed stage 6 in thread ${message.channel.id}`);
    
  } catch (error) {
    logger.error('Error completing stage 6:', error);
  }
}

async function completeStage7(userData: any, message: Message) {
  try {
    const currentTime = new Date();
    
    // Mark stage 7 as completed
    userData.stage7.completedAt = currentTime;
    userData.completedStages.push(7);
    userData.currentStage = 8;
    
    // Save the stage completion immediately
    await userData.save();
    
    // Set stage 8 startedAt if stage 8 is already active
    const stage8ActivationTime = getStageActivationTime(8); // Monday 1st Sep 13:00 UTC
    if (currentTime >= stage8ActivationTime!) {
      userData.stage8.startedAt = currentTime;
      
      message.guild?.channels.fetch('1373769847015473152').then(channel => {
        (channel as TextChannel)?.send({ content: `<@411267877103075338> \`!setdata <@${userData.userId}> <path> +50\`` });
      });

    // Send completion message
    const completionEmbed = new EmbedBuilder()
      .setDescription('You have successfully completed Stage 7!')
    
    if (message.channel?.isThread() && message.channel.id === userData.threadId) {
      await (message.channel as any).send({ content: "↘", embeds: [completionEmbed] });
    }

      // Send stage 8 content immediately
      const stage8Embed = new EmbedBuilder()
        .setTitle("STAGE 8/10")
        .setDescription("-# Difficulty: MEDIUM\n\nYour body begins to fade slightly. Staring at the palm of your hands, they start to become more and more opaque until even your sight vanishes. A few seconds later, your body gathers its particles and restores itself—the only difference being your location; you now stand at the face of a dungeon.\n\nYou lightly step into the cave, lit only by fireflies. Moss and leaves grow from the walls, and a thick fog drifts from deeper within.\n\nSuddenly, you hear a rustling sound. An armored, tree-like body covered in a mane of leaves, with feathers sprouting from its back, emerges from the rubble. You instantly draw your weapon, preparing for a battle to the death with the fallen sovereign.\n\n*\"I only wanted to talk,\"* you exclaim, yet it pays no attention and launches thorns vigorously.\n\nFrom the feathers on its back, a potion slips and falls onto a pile of leaves. You are drawn to it, but are clueless as to what it is. Before you drink it, you must know the name of the potion. It is something you are certain you have seen and used before, but you cannot recall its name. As you hesitate, the sparkling white-and-blue potion pulses with a radiant, white aura.")
      
      if (message.channel?.isThread()) {
        await (message.channel as any).send({ content: `<@${userData.userId}>`, embeds: [stage8Embed], components: [hintButtonRow]  });
      }
      
      // Save the stage8 startedAt
      await userData.save();
    }
    
    logger.info(`User ${message.author.tag} completed stage 7 in thread ${message.channel.id}`);
    
  } catch (error) {
    logger.error('Error completing stage 7:', error);
  }
}

async function completeStage8(userData: any, message: Message) {
  try {
    const currentTime = new Date();
    
    // Mark stage 8 as completed
    userData.stage8.completedAt = currentTime;
    userData.completedStages.push(8);
    userData.currentStage = 9;
    
    // Save the stage completion immediately
    await userData.save();
    
    // Set stage 9 startedAt if stage 9 is already active
    const stage9ActivationTime = getStageActivationTime(9); // Tuesday 2nd Sep 13:00 UTC
    if (currentTime >= stage9ActivationTime!) {
      userData.stage9.startedAt = currentTime;
      

          // Send completion message
    const completionEmbed = new EmbedBuilder()
    .setDescription('You have successfully completed Stage 8!')
  
  if (message.channel?.isThread() && message.channel.id === userData.threadId) {
    await (message.channel as any).send({ content: "↘", embeds: [completionEmbed] });
  }
      // Send stage 9 content immediately
      const stage9Embed = new EmbedBuilder()
        .setTitle("STAGE 9/10")
        .setDescription("-# Difficulty: HARD\n\nThe Time Potion! You recall it, certain it is safe. You drink it, and in an instant, you find yourself back at the dungeon's gate. This time, you take a different approach. At each step, you gently announce that you are here to speak with the Wildheart Sovereign and that you bring no harm.\n\nAs you reach the spot where you previously encountered the fallen deity, it awaits you—ready for discussion, yet still eerily cautious.\n\nYou ask the deity if it recalls the sovereign's treasure. It responds,\n*\"Thousands of years have passed since I rested that treasure in this world. The Omnipotent tampered with my memories once I betrayed the trust of my previous colleagues; not much memory remains of that time. I am certain the Omnipotent had laid a hidden code somewhere in Mysthaven, at a request I had made. Although I do not recall the details—it is still out there, ready to be found.\"*")
      
      if (message.channel?.isThread()) {
        await (message.channel as any).send({ content: `<@${userData.userId}>`, embeds: [stage9Embed], components: [hintButtonRow]  });
      }
      
      // Save the stage9 startedAt
      await userData.save();
    }
    
    logger.info(`User ${message.author.tag} completed stage 8 in thread ${message.channel.id}`);
    
  } catch (error) {
    logger.error('Error completing stage 8:', error);
  }
}

async function completeStage9(userData: any, message: Message) {
  try {
    const currentTime = new Date();
    
    // Mark stage 9 as completed
    userData.stage9.completedAt = currentTime;
    userData.completedStages.push(9);
    userData.currentStage = 10;
    
    // Save the stage completion immediately
    await userData.save();
    
    // Set stage 10 startedAt if stage 10 is already active
    const stage10ActivationTime = getStageActivationTime(10); // Wednesday 3rd Sep 13:00 UTC
    if (currentTime >= stage10ActivationTime!) {
      userData.stage10.startedAt = currentTime;
      
          // Send completion message
    const completionEmbed = new EmbedBuilder()
    .setDescription('You have successfully completed Stage 9!')
  
  if (message.channel?.isThread() && message.channel.id === userData.threadId) {
    await (message.channel as any).send({ content: "↘", embeds: [completionEmbed] });
  }

      // Send stage 10 content immediately
      const stage10Embed = new EmbedBuilder()
        .setTitle("STAGE 10/10")
        .setDescription("-# Difficulty: EASY\n\nA dark, mysterious portal opens before you. The device the Korok had given you is swallowed by the portal as if it were a black hole. The portal rumbles and shakes before it shoots out a scroll, which reads:\n\n*\"All power and strength will be yielded by the one who speaks the final code — no hints, no more to the Sovereign's story.\"*")
      
      if (message.channel?.isThread()) {
        await (message.channel as any).send({ content: `<@${userData.userId}>`, embeds: [stage10Embed], components: [hintButtonRow]  });
      }
      
      // Save the stage10 startedAt
      await userData.save();
    }
    
    logger.info(`User ${message.author.tag} completed stage 9 in thread ${message.channel.id}`);
    
  } catch (error) {
    logger.error('Error completing stage 9:', error);
  }
}

async function completeStage10(userData: any, message: Message) {
  try {
    const currentTime = new Date();
    
    // Mark stage 10 as completed
    userData.stage10.completedAt = currentTime;
    userData.completedStages.push(10); // Event completed
    
    await userData.save();
    
    // Send completion message
    const completionEmbed = new EmbedBuilder()
      .setDescription('Congratulations, and thank you for helping Mysthaven grow. Your rewards will be delivered when the event ends. Rest now, adventurer, before returning to your main quest.')
      .setTimestamp();

    const hiddenPrize = new EmbedBuilder()
      .setDescription("**BONUS PRIZE**\nThe final key is already yours. You've seen it, you know it—speak it, and the prize is claimed.")
    
    if (message.channel?.isThread() && message.channel.id === userData.threadId) {
      await (message.channel as any).send({ content: `<@${userData.userId}>`, embeds: [completionEmbed, hiddenPrize] });
    }
    
    logger.info(`User ${message.author.tag} completed the entire event in thread ${message.channel.id}`);
    
  } catch (error) {
    logger.error('Error completing stage 10:', error);
  }
}

async function completeBonusPrize(userData: any, message: Message) {
  try {
    const currentTime = new Date();
    
    // Mark stage 10 as completed
    userData.bonusClaimedAt = currentTime;
    userData.bonusClaimed = true;
   
    await userData.save();
    
    logger.info(`User ${message.author.tag} claimed bonus event prize in thread ${message.channel.id}`);
    
  } catch (error) {
    logger.error('Error bonus prize:', error);
  }
}