import { Message } from "discord.js";
import { ensureConnected } from "../bot/voice/connection";
import { setupReceiverForGuild } from "../bot/voice/receiver";
import { getVoiceConnection } from "@discordjs/voice";
import { pendingKicks, eligibleForKick } from "../bot/voice/kick";
import { playLeroLeroAudio } from "../bot/voice/audio";

export async function onMessageCreate(message: Message) {
  if (!message.guild || message.author.bot) return;

  if (message.content === "!entrar") {
    console.log(
      `[message-entrar] Executando !entrar por ${message.author.username} em ${message.guild?.name}`
    );
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
    console.log(
      `[message-sair] Executando !sair por ${message.author.username} em ${message.guild?.name}`
    );
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

  if (message.content === "!lerolero") {
    console.log(
      `[message-lerolero] Executando !lerolero por ${message.author.username} em ${message.guild?.name}`
    );

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply("Você precisa estar em um canal de voz para usar este comando.");
    }

    const existing = getVoiceConnection(message.guild.id);
    if (!existing) {
      return message.reply("Eu não estou conectado em nenhum canal de voz. Use !entrar primeiro.");
    }

    // Verificar se está no mesmo canal
    const botChannelId = existing.joinConfig.channelId;
    if (botChannelId !== voiceChannel.id) {
      const botChannelName = message.guild.channels.cache.get(botChannelId!)?.name || "outro canal";
      return message.reply(`Estamos em canais diferentes. Você está em ${voiceChannel.name} e eu estou em ${botChannelName}.`);
    }

    try {
      playLeroLeroAudio(message.guild);
      message.reply(`Tocando áudio aleatório de lero-lero em ${voiceChannel.name}!`);
      console.log(`[message-lerolero] Áudio de lero-lero tocado por ${message.author.username} em ${voiceChannel.name}`);
    } catch (e) {
      console.error("Erro ao tocar lero-lero:", e);
      message.reply("Não consegui tocar o áudio de lero-lero.");
    }
  }
}