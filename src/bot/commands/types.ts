import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ButtonInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
} from "discord.js";

export interface SlashCommand {
  data: RESTPostAPIApplicationCommandsJSONBody;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  guildId: string;
  userId: string;
  voiceChannel?: import("discord.js").VoiceBasedChannel | null;
}

export interface EnterCommandOptions {
  channelId?: string;
}

export interface ExitCommandOptions {
  confirm?: boolean;
}