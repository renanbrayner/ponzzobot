import { VoiceState } from "discord.js";
import { eligibleForKick, clearKick, scheduleKick, pendingKicks } from "../bot/voice/kick";
import { botInSameVoiceChannelNow } from "../bot/voice/connection";
import { setupReceiverForGuild } from "../bot/voice/receiver";

export function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  // usuário entrou
  if (!oldState.channelId && newState.channelId) {
    eligibleForKick.set(member.id, true);
    console.log(`[eligibility] ${member.displayName} elegível=true (entrou)`);
    console.log(`${member.displayName} entrou em ${newState.channel?.name}`);
    if (botInSameVoiceChannelNow(newState.guild!, newState.channelId)) {
      scheduleKick(member, newState.channel!);
    } else {
      console.log(`[skip] bot não está pronto no canal ${newState.channel?.name}`);
    }
    setImmediate(() => setupReceiverForGuild(newState.guild!));
  }

  // usuário mudou
  if (
    oldState.channelId &&
    newState.channelId &&
    oldState.channelId !== newState.channelId
  ) {
    clearKick(member.id);
    eligibleForKick.set(member.id, true);
    console.log(`[eligibility] ${member.displayName} elegível=true (mudou)`);
    console.log(`${member.displayName} moveu-se para ${newState.channel?.name}`);
    if (botInSameVoiceChannelNow(newState.guild!, newState.channelId)) {
      scheduleKick(member, newState.channel!);
    } else {
      console.log(`[skip] bot não está pronto no canal ${newState.channel?.name}`);
    }
    setImmediate(() => setupReceiverForGuild(newState.guild!));
  }

  // usuário saiu
  if (oldState.channelId && !newState.channelId) {
    clearKick(member.id);
    eligibleForKick.delete(member.id);
    console.log(`[eligibility] ${member.displayName} removido (saiu)`);
    console.log(`${member.displayName} saiu do canal`);
  }

  // próprio bot movido/desconectado: limpe timeouts
  const isSelf =
    newState.id === newState.client.user?.id ||
    oldState.id === oldState.client.user?.id;
  if (isSelf) {
    if (oldState.channelId && !newState.channelId) {
      console.log("[bot] Bot saiu do canal; cancelando timeouts pendentes");
      for (const [userId, t] of pendingKicks) {
        clearTimeout(t);
        pendingKicks.delete(userId);
        eligibleForKick.delete(userId);
      }
    }
    if (
      oldState.channelId &&
      newState.channelId &&
      oldState.channelId !== newState.channelId
    ) {
      console.log("[bot] Bot mudou de canal; cancelando timeouts pendentes");
      for (const [userId, t] of pendingKicks) {
        clearTimeout(t);
        pendingKicks.delete(userId);
        eligibleForKick.delete(userId);
      }
    }
  }
}