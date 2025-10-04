import {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
  Colors,
  ChatInputCommandInteraction,
} from "discord.js";
import { SlashCommand } from "./types";
import { getVoiceConnection } from "@discordjs/voice";
import { ensureConnected } from "../voice/connection";
import { setupReceiverForGuild } from "../voice/receiver";

export const enterCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("entrar")
    .setDescription("Entra no canal de voz atual")
    .addChannelOption((option) =>
      option
        .setName("canal")
        .setDescription("Canal de voz específico para entrar")
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(0) // Qualquer um pode usar
    .setDMPermission(false) // Apenas em servidores
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction) {
    // Verificar se o membro está em um canal de voz
    const voiceChannel = (interaction.member as any)?.voice?.channel;
    const targetChannel = interaction.options.getChannel("canal") as any;

    // Se especificou um canal, usa ele; senão, usa o canal do usuário
    const finalChannel = targetChannel || voiceChannel;

    if (!finalChannel) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("🔇 Não é possível entrar")
        .setDescription(
          "Você precisa estar em um canal de voz ou especificar um canal com `/entrar canal:#canal`"
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Verificar se o bot já está conectado
    const existing = getVoiceConnection(interaction.guildId!);
    if (existing) {
      const currentChannel = interaction.guild?.channels.cache.get(
        // @ts-ignore
        existing.joinConfig.channelId
      );
      const embed = new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle("🔊 Já estou conectado")
        .setDescription(
          `Já estou conectado ao canal **${currentChannel?.name || "desconhecido"}**`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Tentar conectar
    try {
      await interaction.deferReply(); // Resposta deferida para conexões demoradas

      console.log(`[slash-entrar] Conectando ao canal ${finalChannel.name}`);

      await ensureConnected(finalChannel);
      await setupReceiverForGuild(interaction.guild!);

      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle("✅ Conectado com sucesso")
        .setDescription(
          `Entrei no canal **${finalChannel.name}**\n\n` +
          `Use \`/sair\` para me desconectar.`
        )
        .addFields(
          { name: "🔧 Tipo de comando", value: "Slash Command `/entrar`", inline: true },
          { name: "👥 Usuário", value: interaction.user.username, inline: true }
        )
        .setTimestamp()
        .setFooter({
          text: "Bot de Kick por Inatividade",
          iconURL: interaction.client.user?.displayAvatarURL(),
        });

      await interaction.editReply({ embeds: [embed] });

      console.log(
        `[slash-entrar] Bot conectado em ${finalChannel.name} por ${interaction.user.username}`
      );

    } catch (error) {
      console.error("[slash-entrar] Erro ao conectar:", error);

      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("❌ Erro ao conectar")
        .setDescription(
          "Não foi possível entrar no canal de voz. Verifique se tenho permissões suficientes."
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },
};