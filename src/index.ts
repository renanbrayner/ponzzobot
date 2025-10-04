import "dotenv/config";
import { Events } from "discord.js";
import { client } from "./bot/client";
import { onMessageCreate } from "./events/messageCreate";
import { onVoiceStateUpdate } from "./events/voiceStateUpdate";

client.once(Events.ClientReady, (c) => {
  console.log(`Bot ${c.user.tag} online`);
  console.log(`Em ${c.guilds.cache.size} servidores:`);
  c.guilds.cache.forEach((g) => console.log(`- ${g.name} (${g.id})`));
});

client.on(Events.MessageCreate, onMessageCreate);
client.on(Events.VoiceStateUpdate, onVoiceStateUpdate);

process.on("unhandledRejection", (r) => {
  console.error("UnhandledRejection:", r);
});
process.on("uncaughtException", (e) => {
  console.error("UncaughtException:", e);
});

client.login(process.env.DISCORD_TOKEN);