import { Client, GatewayIntentBits, Collection, Events, ActivityType } from 'discord.js';
import { config } from 'dotenv';
import { connectDatabase } from './database/connection';
import { loadCommands } from './handlers/commandHandler';
import { loadEvents } from './handlers/eventHandler';
import { logger } from './utils/logger';
import { startStageScheduler } from './utils/scheduler';

// Load environment variables
config();

// Create Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ]
});

// Initialize collections
client.commands = new Collection();
client.cooldowns = new Collection();

// Bot ready event
client.once(Events.ClientReady, async () => {
  logger.info(`Logged in as ${client.user?.tag}`);
  
  // Set bot status
  client.user?.setActivity('Hosting Echoes of Mysthaven', { type: ActivityType.Custom });
  
  // Load commands and events
  try {
    await loadCommands(client);
    await loadEvents(client);
    
    // Start the stage progression scheduler
    startStageScheduler(client);
    
    logger.info('Bot is ready!');
  } catch (error) {
    logger.error('Error loading commands or events:', error);
  }
});

// Error handling
client.on(Events.Error, (error) => {
  logger.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Initialize bot
async function initializeBot() {
  try {
    // Debug: Check environment variables
    logger.info('Environment variables loaded:');
    logger.info(`DISCORD_TOKEN: ${process.env.DISCORD_TOKEN ? 'Set' : 'Not set'}`);
    logger.info(`MONGODB_URI: ${process.env.MONGODB_URI ? 'Set' : 'Not set'}`);
    
    // Connect to MongoDB
    await connectDatabase();
    
    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    logger.error('Failed to initialize bot:', error);
    process.exit(1);
  }
}

// Start the bot
initializeBot();
