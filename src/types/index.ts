import { Client, Collection, ChatInputCommandInteraction, SlashCommandBuilder, Message, MessageCreateOptions } from 'discord.js';

// Extend Discord.js Client with custom properties
declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, Command>;
    cooldowns: Collection<string, Collection<string, number>>;
  }
}

// Command interface that supports both slash and message commands
export interface Command {
  data?: SlashCommandBuilder;
  name: string;
  description: string;
  aliases?: string[];
  execute: (interaction: ChatInputCommandInteraction | Message, args?: string[]) => Promise<void>;
  cooldown?: number;
  isSlashCommand?: boolean;
  isMessageCommand?: boolean;
}

// Event interface
export interface Event {
  name: string;
  once?: boolean;
  execute: (...args: any[]) => Promise<void> | void;
}

// Event data structure (without id to avoid conflict with Mongoose Document)
export interface EventData {
  name: string;
  description: string;
  startTime: Date;
  endTime: Date;
  maxParticipants: number;
  participants: string[];
  channelId: string;
  messageId?: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Participant data structure
export interface Participant {
  userId: string;
  username: string;
  joinedAt: Date;
  status: 'confirmed' | 'maybe' | 'declined';
}
