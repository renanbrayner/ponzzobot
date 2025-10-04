import { REST, Routes } from "discord.js";
import { client } from "../client";
import { SlashCommand } from "./types";
import { enterCommand } from "./entrar";
import { exitCommand } from "./sair";

// Array com todos os comandos
export const commands: SlashCommand[] = [
  enterCommand,
  exitCommand,
];

// Função para registrar comandos na API do Discord
export async function deployCommands() {
  try {
    console.log(`[deploy] Iniciando deploy de ${commands.length} comandos...`);

    const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

    // Pega todos os servidores onde o bot está
    const guilds = client.guilds.cache;

    if (guilds.size === 0) {
      console.log("[deploy] Bot não está em nenhum servidor");
      return;
    }

    // Deploy por servidor (modo desenvolvimento - instantâneo)
    for (const [guildId, guild] of guilds) {
      try {
        await rest.put(
          Routes.applicationGuildCommands(client.user!.id, guildId),
          {
            body: commands.map((cmd) => cmd.data),
          }
        );
        console.log(`[deploy] Comandos registrados em ${guild.name} (${guildId})`);
      } catch (error) {
        console.error(`[deploy] Erro ao registrar em ${guild.name}:`, error);
      }
    }

    console.log("[deploy] Deploy de comandos concluído!");
  } catch (error) {
    console.error("[deploy] Erro geral no deploy:", error);
  }
}

// Função para deploy global (produção - 1 hora para propagar)
export async function deployGlobalCommands() {
  try {
    console.log("[deploy] Iniciando deploy global de comandos...");

    const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

    await rest.put(Routes.applicationCommands(client.user!.id), {
      body: commands.map((cmd) => cmd.data),
    });

    console.log("[deploy] Comandos globais registrados com sucesso!");
  } catch (error) {
    console.error("[deploy] Erro no deploy global:", error);
  }
}