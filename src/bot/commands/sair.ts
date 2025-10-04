import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ChatInputCommandInteraction,
} from "discord.js";
import { SlashCommand } from "./types";
import { getVoiceConnection } from "@discordjs/voice";
import { pendingKicks, eligibleForKick } from "../voice/kick";

export const exitCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("sair")
    .setDescription("Sai do canal de voz atual")
    .setDefaultMemberPermissions(0) // Qualquer um pode usar
    .setDMPermission(false) // Apenas em servidores
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction) {
    const conn = getVoiceConnection(interaction.guildId!);

    if (!conn) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("🔇 Não estou conectado")
        .setDescription("Não estou em nenhum canal de voz neste servidor.")
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Criar embed de confirmação
    const embed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle("🔊 Confirmar saída")
      .setDescription("Tem certeza que deseja que eu saia do canal de voz?")
      .addFields(
        {
          name: "🎯 Canal atual",
          value: `${
            interaction.guild?.channels.cache.get(
              // @ts-ignore
              conn.joinConfig.channelId
            )?.name || "desconhecido"
          }`,
          inline: true,
        },
        {
          name: "⚠️ Aviso",
          value: "Todos os kicks pendentes serão cancelados",
          inline: true,
        }
      )
      .setTimestamp()
      .setFooter({
        text: "Use /entrar para me reconectar",
      });

    // Criar botões
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm_exit")
        .setLabel("✅ Sim, sair")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("cancel_exit")
        .setLabel("❌ Cancelar")
        .setStyle(ButtonStyle.Secondary)
    );

    // Enviar mensagem com botões
    const reply = await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
      fetchReply: true,
    });

    // Coletor de interações dos botões
    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 15000, // 15 segundos para responder
    });

    collector.on("collect", async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: "Você não pode usar estes botões.",
          ephemeral: true,
        });
        return;
      }

      if (buttonInteraction.customId === "confirm_exit") {
        try {
          // Cancelar todos os kicks pendentes
          let cancelledCount = 0;
          for (const [userId, timeout] of pendingKicks) {
            clearTimeout(timeout);
            pendingKicks.delete(userId);
            eligibleForKick.delete(userId);
            cancelledCount++;
          }

          // Obter nome do canal antes de destruir
          const channelName =
            interaction.guild?.channels.cache.get(
              // @ts-ignore
              conn.joinConfig.channelId
            )?.name || "desconhecido";

          // Destruir conexão
          conn.destroy();

          // Embed de sucesso
          const successEmbed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle("✅ Desconectado com sucesso")
            .setDescription(`Saí do canal **${channelName}**`)
            .addFields(
              {
                name: "🔧 Tipo de comando",
                value: "Slash Command `/sair`",
                inline: true,
              },
              {
                name: "🚫 Kicks cancelados",
                value: cancelledCount.toString(),
                inline: true,
              }
            )
            .setTimestamp()
            .setFooter({
              text: "Bot de Kick por Inatividade",
              iconURL: interaction.client.user?.displayAvatarURL(),
            });

          await buttonInteraction.update({
            embeds: [successEmbed],
            components: [], // Remover botões
          });

          console.log(
            `[slash-sair] Bot desconectado de ${channelName} por ${interaction.user.username} (${cancelledCount} kicks cancelados)`
          );

        } catch (error) {
          console.error("[slash-sair] Erro ao desconectar:", error);

          const errorEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle("❌ Erro ao desconectar")
            .setDescription("Ocorreu um erro ao tentar sair do canal.")
            .setTimestamp();

          await buttonInteraction.update({
            embeds: [errorEmbed],
            components: [], // Remover botões
          });
        }

        collector.stop();
      } else if (buttonInteraction.customId === "cancel_exit") {
        const cancelEmbed = new EmbedBuilder()
          .setColor(Colors.Blue)
          .setTitle("❌ Operação cancelada")
          .setDescription("Vou continuar no canal de voz.")
          .setTimestamp();

        await buttonInteraction.update({
          embeds: [cancelEmbed],
          components: [], // Remover botões
        });

        collector.stop();
      }
    });

    // Se o tempo acabar
    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        const timeoutEmbed = new EmbedBuilder()
          .setColor(Colors.Grey)
          .setTitle("⏰ Tempo esgotado")
          .setDescription("Você não respondeu a tempo. Vou continuar no canal.")
          .setTimestamp();

        await interaction.editReply({
          embeds: [timeoutEmbed],
          components: [], // Remover botões
        });
      }
    });
  },
};