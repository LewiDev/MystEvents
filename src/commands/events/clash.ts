import { Message } from 'discord.js';
import { ClashTeam } from '../models/ClashTeam';
import { ClashMemberState } from '../models/ClashMemberState';
import { ClashEventConfig } from '../models/ClashEventConfig';
import { startCountingStage } from '../clash/services/stages/counting';
import { rfLedger } from '../clash/services/rfLedger';

// Identifier for the active event. In a real bot this might be loaded
// from configuration or passed into command execution. For now we
// hard‑code a constant for a single running event.
const ACTIVE_EVENT_ID = 'cotr';

export default {
  name: 'clash',
  /**
   * Entry point for the ?clash command. Supports subcommands:
   * - teamname {name}: create or rename a team for the calling user
   * - startstage {day}: initiate the day’s quest for the team (only day 1 implemented)
   *
   * @param message The message that triggered the command
   * @param args Arguments following the command name
   */
  async execute(message: Message, args: string[]): Promise<void> {
    if (!args.length) return;
    const sub = args[0].toLowerCase();
    if (sub === 'teamname') {
      const name = args.slice(1).join(' ').trim();
      if (!name) {
        await message.reply('Please provide a team name.');
        return;
      }
      // Look up existing team for user
      let team = await ClashTeam.findOne({ eventId: ACTIVE_EVENT_ID, memberIds: { $in: [message.author.id] } }).exec();
      if (team) {
        // Rename team
        team.name = name;
        await team.save();
        try {
          // Rename channel if bot has permission
          const chan = await message.client.channels.fetch(team.channelId).catch(() => null);
          if (chan && chan.isTextBased()) {
            // @ts-ignore
            await chan.setName(name).catch(() => {});
          }
        } catch {
          /* ignore rename errors */
        }
        await message.reply(`Your team has been renamed to **${name}**.`);
        return;
      }
      // Create new team
      const highest = await ClashTeam.find({ eventId: ACTIVE_EVENT_ID }).sort({ teamNumber: -1 }).limit(1).exec();
      const nextNum = highest.length ? highest[0].teamNumber + 1 : 1;
      team = new ClashTeam({
        eventId: ACTIVE_EVENT_ID,
        teamNumber: nextNum,
        name,
        channelId: message.channel.id,
        threadByDay: {},
        memberIds: [message.author.id],
        captainId: message.author.id,
        captainHistory: [ { userId: message.author.id, from: new Date() } ],
      });
      await team.save();
      // Create member state
      await ClashMemberState.findOneAndUpdate(
        { eventId: ACTIVE_EVENT_ID, teamNumber: nextNum, userId: message.author.id },
        { $setOnInsert: { messageCount: 0, perDayStarted: [], cooldowns: [] } },
        { upsert: true }
      ).exec();
      await message.reply(`Team **${name}** created! You are the captain.`);
      return;
    }
    if (sub === 'startstage') {
      const dayNum = parseInt(args[1] ?? '', 10);
      if (isNaN(dayNum)) {
        await message.reply('Please specify the day number to start (e.g. `?clash startstage 1`).');
        return;
      }
      // Only day 1 implemented (counting)
      if (dayNum !== 1) {
        await message.reply('Only day 1 is currently supported in this scaffold.');
        return;
      }
      // Determine team
      const team = await ClashTeam.findOne({ eventId: ACTIVE_EVENT_ID, memberIds: { $in: [message.author.id] } }).exec();
      if (!team) {
        await message.reply('You are not part of a team for this event. Use `?clash teamname <name>` to create one.');
        return;
      }
      // Determine thread for the day; fallback to current channel if none
      let thread;
      const threadId = (team.threadByDay as any)?.[dayNum];
      if (threadId) {
        thread = await message.client.channels.fetch(threadId).catch(() => null);
      }
      if (!thread) {
        // fallback: use current channel as thread when scheduler not yet implemented
        // @ts-ignore
        thread = message.channel;
      }
      // Start the counting stage
      await startCountingStage({
        eventId: ACTIVE_EVENT_ID,
        teamNumber: team.teamNumber,
        day: dayNum,
        teamThread: thread as any,
        starterId: message.author.id,
      });
      return;
    }
  },
};