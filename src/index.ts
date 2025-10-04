import "dotenv/config";
import { Events } from "discord.js";
import { client } from "./bot/client";
import { onMessageCreate } from "./events/messageCreate";
import { onVoiceStateUpdate } from "./events/voiceStateUpdate";
import { onInteractionCreate } from "./events/interactionCreate";
import { onReady } from "./events/ready";

client.once(Events.ClientReady, onReady);
client.on(Events.MessageCreate, onMessageCreate);
client.on(Events.VoiceStateUpdate, onVoiceStateUpdate);
client.on(Events.InteractionCreate, onInteractionCreate);

process.on("unhandledRejection", (r) => {
  console.error("UnhandledRejection:", r);
});
process.on("uncaughtException", (e) => {
  console.error("UncaughtException:", e);
});

client.login(process.env.DISCORD_TOKEN);