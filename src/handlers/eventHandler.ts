import { Client } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Event } from '../types';
import { logger } from '../utils/logger';

export async function loadEvents(client: Client): Promise<void> {
  const eventsPath = join(__dirname, '..', 'events');
  
  // Debug: Log the path being used
  logger.info(`Looking for events in: ${eventsPath}`);
  
  try {
    // Check if directory exists
    const fs = require('fs');
    const exists = fs.existsSync(eventsPath);
    logger.info(`Events directory exists: ${exists}`);
    
    if (exists) {
      const contents = fs.readdirSync(eventsPath);
      logger.info(`Events directory contents: ${contents.join(', ')}`);
    }
    
    const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    logger.info(`Found event files: ${eventFiles.join(', ')}`);
    
    for (const file of eventFiles) {
      const filePath = join(eventsPath, file);
      logger.info(`Loading event from: ${filePath}`);
      
      try {
        const event: Event = require(filePath).default || require(filePath);
        
        if (event.once) {
          client.once(event.name, event.execute);
        } else {
          client.on(event.name, event.execute);
        }
        
        logger.debug(`Loaded event: ${event.name}`);
      } catch (eventError) {
        logger.error(`Error loading event from ${filePath}:`, eventError);
      }
    }
    
    logger.info(`Successfully loaded ${eventFiles.length} events`);
  } catch (error) {
    logger.error('Error loading events:', error);
    throw error;
  }
}
