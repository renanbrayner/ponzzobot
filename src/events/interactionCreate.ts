import { Events, Interaction } from "discord.js";
import { commands } from "../bot/commands";

export async function onInteractionCreate(interaction: Interaction) {
  // Verificar se é um slash command
  if (!interaction.isChatInputCommand()) return;

  const command = commands.find((cmd) => cmd.data.name === interaction.commandName);

  if (!command) {
    console.error(`[interaction] Comando não encontrado: ${interaction.commandName}`);
    return;
  }

  try {
    console.log(
      `[interaction] Executando slash command /${interaction.commandName} por ${interaction.user.username} em ${interaction.guild?.name}`
    );

    await command.execute(interaction);

  } catch (error) {
    console.error(`[interaction] Erro ao executar /${interaction.commandName}:`, error);

    // Tentar responder se ainda não respondeu
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "Ocorreu um erro ao executar este comando!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "Ocorreu um erro ao executar este comando!",
        ephemeral: true,
      });
    }
  }
}