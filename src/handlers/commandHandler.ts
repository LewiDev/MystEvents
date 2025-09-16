import { Client, Collection, REST, Routes, ApplicationCommandDataResolvable } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Command } from '../types';
import { logger } from '../utils/logger';

export async function loadCommands(client: Client): Promise<void> {
  const slashCommands: ApplicationCommandDataResolvable[] = [];
  
  // Debug: Log current directory and resolve path
  logger.info(`Current __dirname: ${__dirname}`);
  const commandsPath = join(__dirname, '..', 'commands');
  logger.info(`Looking for commands in: ${commandsPath}`);
  
  // Check if directory exists
  try {
    const fs = require('fs');
    const exists = fs.existsSync(commandsPath);
    logger.info(`Commands directory exists: ${exists}`);
    
    if (exists) {
      const contents = fs.readdirSync(commandsPath);
      logger.info(`Commands directory contents: ${contents.join(', ')}`);
    }
  } catch (error) {
    logger.error('Error checking commands directory:', error);
  }
  
  try {
    // Read command directories
    const commandFolders = readdirSync(commandsPath);
    logger.info(`Found command folders: ${commandFolders.join(', ')}`);
    
    for (const folder of commandFolders) {
      const folderPath = join(commandsPath, folder);
      logger.info(`Processing folder: ${folderPath}`);
      
      const commandFiles = readdirSync(folderPath).filter(file => file.endsWith('.js'));
      logger.info(`Found command files in ${folder}: ${commandFiles.join(', ')}`);
      
      for (const file of commandFiles) {
        const filePath = join(folderPath, file);
        logger.info(`Loading command from: ${filePath}`);
        
        try {
          const command: Command = require(filePath).default || require(filePath);
          
          if ('name' in command && 'execute' in command) {
            // Set command properties
            command.isSlashCommand = !!command.data;
            command.isMessageCommand = true; // All commands can be message commands
            
            client.commands.set(command.name, command);
            
            // Add aliases if they exist
            if (command.aliases) {
              for (const alias of command.aliases) {
                client.commands.set(alias, command);
              }
            }
            
            // Add to slash commands if it has data
            if (command.data) {
              slashCommands.push(command.data.toJSON());
              logger.debug(`Loaded slash command: ${command.name}`);
            } else {
              logger.debug(`Loaded message command: ${command.name}`);
            }
          } else {
            logger.warn(`Command at ${filePath} is missing required properties`);
          }
        } catch (commandError) {
          logger.error(`Error loading command from ${filePath}:`, commandError);
        }
      }
    }
    
    // Register slash commands with Discord
    if (slashCommands.length > 0) {
      await registerSlashCommands(slashCommands);
    }
    
    logger.info(`Successfully loaded ${client.commands.size} commands (${slashCommands.length} slash commands)`);
  } catch (error) {
    logger.error('Error loading commands:', error);
    throw error;
  }
}

async function registerSlashCommands(commands: ApplicationCommandDataResolvable[]): Promise<void> {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    
    logger.info('Started refreshing application (/) commands.');
    
    if (process.env.DISCORD_GUILD_ID) {
      // Register commands for a specific guild (faster for development)
      await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, process.env.DISCORD_GUILD_ID),
        { body: commands }
      );
      logger.info('Successfully reloaded guild (/) commands.');
    } else {
      // Register commands globally (slower, but works across all guilds)
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
        { body: commands }
      );
      logger.info('Successfully reloaded global (/) commands.');
    }
  } catch (error) {
    logger.error('Error registering slash commands:', error);
    throw error;
  }
}
