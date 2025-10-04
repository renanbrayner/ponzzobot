import { GuildMember, VoiceBasedChannel } from "discord.js";
import { CFG } from "../../config";
import { botInSameVoiceChannelNow } from "./connection";
import { playCountdownOnce } from "./audio";

export const pendingKicks = new Map<string, NodeJS.Timeout>();
export const eligibleForKick = new Map<string, boolean>();
export const userTimeoutMultipliers = new Map<string, number>();

export function clearKick(userId: string) {
  const t = pendingKicks.get(userId);
  if (t) {
    clearTimeout(t);
    pendingKicks.delete(userId);
  }
}

export function scheduleKick(member: GuildMember, channel: VoiceBasedChannel) {
  clearKick(member.id);

  if (eligibleForKick.get(member.id) !== true) {
    console.log(`[skip] ${member.displayName} não é elegível`);
    return;
  }

  if (!botInSameVoiceChannelNow(channel.guild, channel.id)) {
    console.log(
      `[skip] Bot não está pronto no mesmo canal ${channel.name}`
    );
    return;
  }

  // Calcular timeout personalizado baseado em penalidades anteriores
  const userPenaltyCount = userTimeoutMultipliers.get(member.id) || 0;
  const personalizedTimeout = CFG.INACTIVITY_TIMEOUT + (userPenaltyCount * CFG.USER_TIMEOUT_INCREMENT);

  try {
    playCountdownOnce(channel.guild);
  } catch (e) {
    console.error("[audio] erro:", e);
  }

  const id = setTimeout(async () => {
    try {
      if (eligibleForKick.get(member.id) !== true) {
        console.log(`[kick-cancel] ${member.displayName} inelegível no timeout`);
        return;
      }

      const userChannelId = member.voice?.channelId || null;
      if (!userChannelId) {
        console.log(`[skip] ${member.displayName} não está mais no canal`);
        return;
      }

      if (!botInSameVoiceChannelNow(channel.guild, userChannelId)) {
        console.log(
          `[skip] Timeout: bot não está no mesmo canal de ${member.displayName}`
        );
        return;
      }

      await member.voice.disconnect();

      // Incrementar penalidade do usuário
      const currentPenalty = userTimeoutMultipliers.get(member.id) || 0;
      userTimeoutMultipliers.set(member.id, currentPenalty + 1);

      console.log(
        `Kick: ${member.displayName} por inatividade (${personalizedTimeout}ms) - penalidade aumentada para ${currentPenalty + 1}`
      );
    } catch (e) {
      console.error(`Erro ao kickar ${member.displayName}:`, e);
    } finally {
      pendingKicks.delete(member.id);
      eligibleForKick.delete(member.id);
    }
  }, personalizedTimeout);

  pendingKicks.set(member.id, id);
  console.log(
    `Agendado kick para ${member.displayName} em ${personalizedTimeout}ms (base: ${CFG.INACTIVITY_TIMEOUT}ms + penalidade: ${userPenaltyCount * CFG.USER_TIMEOUT_INCREMENT}ms)`
  );
}