import { Message } from "discord.js";
import { ensureConnected } from "../bot/voice/connection";
import { setupReceiverForGuild } from "../bot/voice/receiver";
import { getVoiceConnection } from "@discordjs/voice";
import { pendingKicks, eligibleForKick } from "../bot/voice/kick";

export async function onMessageCreate(message: Message) {
  if (!message.guild || message.author.bot) return;

  if (message.content === "!entrar") {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply("Entre em um canal de voz para usar este comando.");
    }
    const existing = getVoiceConnection(message.guild.id);
    if (existing) {
      const current =
        message.guild.channels.cache.get(
          // @ts-ignore
          existing.joinConfig.channelId
        )?.name || "desconhecido";
      return message.reply(`Já estou conectado (canal: ${current}).`);
    }
    try {
      await ensureConnected(voiceChannel);
      message.reply(`Entrei em ${voiceChannel.name}.`);
      setupReceiverForGuild(message.guild);
    } catch (e) {
      console.error("Erro ao entrar:", e);
      message.reply("Não consegui entrar no canal de voz.");
    }
  }

  if (message.content === "!sair") {
    const conn = getVoiceConnection(message.guild.id);
    if (!conn) {
      return message.reply("Não estou conectado.");
    }
    try {
      const name =
        message.guild.channels.cache.get(
          // @ts-ignore
          conn.joinConfig.channelId
        )?.name || "desconhecido";
      conn.destroy();
      // cancela timeouts pendentes
      for (const [userId, t] of pendingKicks) {
        clearTimeout(t);
        pendingKicks.delete(userId);
        eligibleForKick.delete(userId);
      }
      message.reply(`Saí de ${name}.`);
    } catch (e) {
      console.error("Erro ao sair:", e);
      message.reply("Falha ao sair do canal.");
    }
  }
}