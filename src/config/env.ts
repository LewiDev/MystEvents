export interface Env {
  DISCORD_TOKEN: string;
  CLIENT_ID: string;
  MK_ROLE_ID: string;
  BRACKET_CHANNEL_ID: string;
  MATCH_CHANNEL_ID: string;
}

export const env: Env = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN!,
  CLIENT_ID: process.env.CLIENT_ID!,
  MK_ROLE_ID: process.env.MK_ROLE_ID!,
  BRACKET_CHANNEL_ID: process.env.BRACKET_CHANNEL_ID!,
  MATCH_CHANNEL_ID: process.env.MATCH_CHANNEL_ID!
};
