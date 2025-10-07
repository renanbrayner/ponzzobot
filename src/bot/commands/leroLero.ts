import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  ChatInputCommandInteraction,
} from "discord.js";
import { SlashCommand } from "./types";
import { getVoiceConnection } from "@discordjs/voice";
import { playLeroLeroAudio } from "../voice/audio";

export const leroLeroCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("lerolero")
    .setDescription("Toca um áudio aleatório de lero-lero no canal de voz")
    .setDefaultMemberPermissions(0) // Qualquer um pode usar
    .setDMPermission(false) // Apenas em servidores
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction) {
    // Verificar se o membro está em um canal de voz
    const voiceChannel = (interaction.member as any)?.voice?.channel;

    if (!voiceChannel) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("🔇 Você não está em um canal de voz")
        .setDescription(
          "Você precisa estar em um canal de voz para usar este comando."
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Verificar se o bot está conectado
    const existing = getVoiceConnection(interaction.guildId!);
    if (!existing) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("🔊 Não estou conectado")
        .setDescription(
          "Eu preciso estar em um canal de voz para tocar áudios. Use `/entrar` primeiro."
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Verificar se o bot está no mesmo canal
    const botChannelId = existing.joinConfig.channelId;
    if (botChannelId !== voiceChannel.id) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle("⚠️ Estamos em canais diferentes")
        .setDescription(
          `Você está em **${voiceChannel.name}** mas eu estou em **${interaction.guild?.channels.cache.get(botChannelId!)?.name || "outro canal"}**.`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Tentar tocar o áudio
    try {
      await interaction.deferReply(); // Resposta deferida para operações rápidas

      console.log(`[slash-lerolero] Tocando lero-lero por ${interaction.user.username}`);

      playLeroLeroAudio(interaction.guild!);

      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle("🎵 Tocando lero-lero!")
        .setDescription(
          `Áudio aleatório de lero-lero tocando em **${voiceChannel.name}**\n\n` +
          `Use \`/sair\` para me desconectar.`
        )
        .addFields(
          { name: "🔧 Tipo de comando", value: "Slash Command `/lerolero`", inline: true },
          { name: "👥 Usuário", value: interaction.user.username, inline: true }
        )
        .setTimestamp()
        .setFooter({
          text: "Bot de Kick por Inatividade",
          iconURL: interaction.client.user?.displayAvatarURL(),
        });

      await interaction.editReply({ embeds: [embed] });

      console.log(
        `[slash-lerolero] Áudio de lero-lero tocado por ${interaction.user.username} em ${voiceChannel.name}`
      );

    } catch (error) {
      console.error("[slash-lerolero] Erro ao tocar áudio:", error);

      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("❌ Erro ao tocar áudio")
        .setDescription(
          "Não foi possível tocar o áudio de lero-lero. Tente novamente."
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },
};