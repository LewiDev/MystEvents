import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../types';

export default {
  name: 'startevent',
  description: 'Start the Echoes of Mysthaven event',
  aliases: ['start', 'eventstart'],
  cooldown: 0,
  isMessageCommand: true, // Message command
  
  async execute(message: Message, args?: string[]) {
    if (!message.member?.permissions.has('Administrator')) {
      await message.reply('❌ You do not have permission to use this command.');
      return;
    }

    try {
      const embed = new EmbedBuilder()
        .setTitle("**JOIN THE EVENT** <:MysthavenLogo:1383497466602721350>")
        .setDescription("-# To join the event, create a thread below!\n\n**DO NOT TELL OTHERS IF YOU HAVE COMPLETED ALL STAGES**\n\n🚨 **READ FIRST**\n- please read the event info in the embed above\n- to repeat the **important** notes, please do not do share the information to any other user, as said in the *event info*, this will lead to a warn and a 7 day mute\n- **no alt accounts**\n\n✨ **FURTHER EVENT NOTES**\n- each stage ranges in difficulty, from easy > medium > hard \n- easy stages do not have hints (do not worry, if you run the hint command, it will not use up one of your hints)\n- the **secret prize** that occurs at stage 10, only has 1 winner, anyone that claims it afterwards will be rewarded a different prize\n- **DO NOT** @ other users in your thread — this will disqualify you and the user (if the other user is behind you in a stage)\n\n⚠️ **IMPORTANT**\n- do not reveal to anyone if you have completed and won the event\n- if you have won the event, you will not know if you were the first person to do it until **after** the event has ended\n- feel free to tell others that you have completed a stage but upon the **stages 8+ you can no longer reveal if you have done them** - doing so will not mute you however please refrain from doing so as we will warn you\n\n✅ **CONFIRM**\n- react to this message to confirm you have read and fully understood the rules — only then will you be able to create a thread... good luck!");

      const button = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('OneKMem')
            .setLabel('BEGIN EVENT')
            .setStyle(ButtonStyle.Success)
        );

      const sentMessage = await (message.channel as any).send({
        content: "↘",
        embeds: [embed],
        components: [button]
      });
      await sentMessage.react('✅');

    } catch (error) {
      console.error('Error starting event:', error);
      await message.reply('❌ An error occurred while starting the event.');
    }
  }
} as Command;
