import { ThreadChannel, Message, EmbedBuilder } from 'discord.js';
import { ClashStageState } from '../../../models/ClashStageState';
import { ClashTeam } from '../../../models/ClashTeam';
import { rfLedger } from '../rfLedger';
import { logger } from '../../../utils/logger';

/**
 * Helper to test primality. Returns true for prime numbers greater than 1.
 */
function isPrime(n: number): boolean {
  if (n <= 1) return false;
  if (n <= 3) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

// Shape of the JSON stored in ClashStageState.details for the counting stage
interface CountingDetails {
  current: number;
  lastUserId: string | null;
  awaitingRepair: boolean;
  rfThisStage: number;
  endsAt: string;
  sabotageCooldownUntil?: string;
}

const STAGE_KEY = 'counting';
const STAGE_DURATION_MS = 60 * 60 * 1000; // 1h
const RF_PER_CORRECT = 5;
const REPAIR_PHRASE = 'repair the broken fragments';

/**
 * Starts the counting stage for a team on a given day. Sends the
 * introduction embed and initial number and persists an ACTIVE
 * stage record. A scheduled timeout locks and archives the thread
 * after the 1h window expires.
 */
export async function startCountingStage(opts: {
  eventId: string;
  teamNumber: number;
  day: number;
  teamThread: ThreadChannel;
  starterId: string;
}): Promise<void> {
  const { eventId, teamNumber, day, teamThread } = opts;

  // Check if stage already started or completed
  let state = await ClashStageState.findOne({ eventId, teamNumber, day }).exec();
  if (state && (state.status === 'ACTIVE' || state.status === 'COMPLETE')) {
    await teamThread.send('This event has already been completed by your team — please progress with the quests that have not yet been done.');
    return;
  }

  const endsAt = new Date(Date.now() + STAGE_DURATION_MS);

  // Construct the intro embed matching the requested copy
  const embed = new EmbedBuilder()
    .setTitle('**THE ENDLESS COUNT** <:MysthavenLogo:1383497466602721350>')
    .setDescription(
      `-# The quest has now started\n\n` +
        `This is a counting game — count in order, but be cautious! There’s a twist that can reset your team’s progress. Spot it early and see how far you can go!\n\n` +
        `<@590575157718941708> — what you need to code:\n\n` +
        `- the embed\n` +
        `- once the bot sends the message \`5\` the game will start counting\n` +
        `- this stage has a time limit: \`1h\` — afterwards, have the bot lock the thread\n` +
        `- every number they count correctly will gain the team: \`5 RF\`\n` +
        `- if someone types twice in a row: \`RF gets reset to 0 for this stage\`\n` +
        `- if someone types a prime number: \`RF gets reset to 0 for this stage\`\n` +
        `- in replacement of a prime number, users have to type: \`repair the broken fragments\` >> once typed, the bot will send the consecutive number\n` +
        `- Quest time duration: \`1h\`.\n` +
        `- For every number, your team will earn 5 RF.\n` +
        `- Messing up resets your progress.\n` +
        `- You will have to \`repair the broken fragments\`.\n` +
        `- You cannot type twice in a row unless repairing fragments.\n\n` +
        `*The System will start the counting...*`
    );

  await teamThread.send({ embeds: [embed] });

  // Initialize state details
  const details: CountingDetails = {
    current: 4, // Bot will send 5 next
    lastUserId: null,
    awaitingRepair: false,
    rfThisStage: 0,
    endsAt: endsAt.toISOString(),
  };

  // Upsert stage state
  state = await ClashStageState.findOneAndUpdate(
    { eventId, teamNumber, day },
    { $set: { stageKey: STAGE_KEY, status: 'ACTIVE', score: 0, details, startedAt: new Date() } },
    { upsert: true, new: true }
  ).exec();

  // Kick off with '5'
  await teamThread.send('5');

  // Schedule lock and archive after time limit
  setTimeout(async () => {
    try {
      const fresh = await ClashStageState.findOne({ eventId, teamNumber, day }).exec();
      if (!fresh || fresh.status === 'COMPLETE') return;
      await teamThread.send('⏳ The hour has passed. This thread is now locked.');
      await teamThread.setLocked(true).catch(() => {});
      await teamThread.setArchived(true).catch(() => {});
      await ClashStageState.updateOne({ _id: fresh._id }, { $set: { status: 'COMPLETE', completedAt: new Date() } }).exec();
    } catch (err) {
      logger.error('Error locking counting stage thread:', err);
    }
  }, STAGE_DURATION_MS);
}

/**
 * Handles messages within a counting stage thread. Validates
 * sequential counting, enforces prime replacement via repair
 * phrase and resets stage RF on missteps.
 */
export async function handleCountingMessage(
  msg: Message,
  ctx: { eventId: string; team: typeof ClashTeam; day: number }
): Promise<void> {
  // Ignore bot messages or messages outside of active stage
  if (msg.author.bot) return;
  const { eventId, team, day } = ctx;
  const teamNumber = (team as any).teamNumber;
  const state = await ClashStageState.findOne({ eventId, teamNumber, day }).exec();
  if (!state || state.stageKey !== STAGE_KEY || state.status !== 'ACTIVE') return;
  const d = state.details as CountingDetails;
  const now = Date.now();
  if (new Date(d.endsAt).getTime() <= now) return;

  const content = msg.content.trim().toLowerCase();

  // If under sabotage enforced delay, show message and block
  if (d.sabotageCooldownUntil && Date.now() < new Date(d.sabotageCooldownUntil).getTime()) {
    await msg.reply(
      `⛔ This stage is under a temporary lock. Try again <t:${Math.floor(
        new Date(d.sabotageCooldownUntil).getTime() / 1000
      )}:R>.`
    );
    return;
  }

  // Repair flow
  if (d.awaitingRepair) {
    if (content !== REPAIR_PHRASE) {
      // Only accept the repair phrase; ignore other messages
      return;
    }
    // Bot posts the prime number and resets awaitingRepair
    const primeNumber = d.current + 1;
    await msg.channel.send(String(primeNumber));
    d.current = primeNumber;
    d.awaitingRepair = false;
    d.lastUserId = 'BOT';
    await ClashStageState.updateOne({ _id: state._id }, { $set: { details: d } }).exec();
    return;
  }

  // Prevent same user from counting twice in a row
  if (d.lastUserId && d.lastUserId === msg.author.id) {
    // Reset stage RF and inform team
    d.rfThisStage = 0;
    await msg.channel.send('*Oops… you pushed The System too far! Your RF has been completely reset.*');
    d.lastUserId = msg.author.id;
    await ClashStageState.updateOne({ _id: state._id }, { $set: { details: d } }).exec();
    return;
  }

  const expected = d.current + 1;
  // If expected is prime, require repair phrase
  if (isPrime(expected)) {
    const n = Number(content);
    if (!isNaN(n) && n === expected) {
      // User attempted to type the prime number; reset
      d.rfThisStage = 0;
      await msg.channel.send('*Oops… you pushed The System too far! Your RF has been completely reset.*');
      d.awaitingRepair = true;
      d.lastUserId = msg.author.id;
      await ClashStageState.updateOne({ _id: state._id }, { $set: { details: d } }).exec();
      return;
    }
    // Otherwise set awaitingRepair; ignore content until correct phrase
    d.awaitingRepair = true;
    d.lastUserId = msg.author.id;
    await ClashStageState.updateOne({ _id: state._id }, { $set: { details: d } }).exec();
    return;
  }

  // Expecting a composite number; parse numeric input
  const n = Number(content);
  if (!Number.isInteger(n) || n !== expected) {
    // Wrong number: ignore
    return;
  }

  // Correct count: award RF and update state
  await rfLedger.add(teamNumber, RF_PER_CORRECT, { eventId, type: 'STAGE', meta: { stage: STAGE_KEY, day } });
  d.rfThisStage += RF_PER_CORRECT;
  d.current = n;
  d.lastUserId = msg.author.id;
  const newScore = Math.max(state.score ?? 0, n);
  await ClashStageState.updateOne({ _id: state._id }, { $set: { details: d, score: newScore } }).exec();
}