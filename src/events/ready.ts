import { Events, Client } from "discord.js";
import { deployCommands } from "../bot/commands";

export async function onReady(client: Client) {
  console.log(`Bot ${client.user?.tag} online!`);
  console.log(`Em ${client.guilds.cache.size} servidores:`);

  client.guilds.cache.forEach((guild) => {
    console.log(`- ${guild.name} (${guild.id})`);
  });

  // Deploy automático dos slash commands
  console.log("\n[ready] Iniciando deploy dos slash commands...");
  await deployCommands();

  console.log("[ready] Bot totalmente inicializado!");
}