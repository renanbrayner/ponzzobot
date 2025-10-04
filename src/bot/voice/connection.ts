import {
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnection,
} from "@discordjs/voice";
import { Guild, VoiceBasedChannel } from "discord.js";

export function logConnState(conn?: VoiceConnection, label = "") {
  try {
    const s = conn?.state;
    console.log(
      `[voice] ${label} status=${s?.status}`
    );
  } catch (e) {
    console.log("[voice] erro ao inspecionar estado:", e);
  }
}

export function attachConnDebug(conn?: VoiceConnection) {
  if (!conn) return;
  conn.on("stateChange", (oldS, newS) => {
    console.log(`[voice] conn state: ${oldS.status} -> ${newS.status}`);
  });
  // @ts-ignore - networking pode não estar disponível em todos os estados
  const net = conn.state.networking;
  if (net) {
    net.on("stateChange", (oldN: any, newN: any) => {
      console.log(
        `[voice] net state: ${oldN.status} -> ${newN.status}`
      );
    });
  }
}

export function botInSameVoiceChannelNow(
  guild: Guild,
  channelId: string | null | undefined
): boolean {
  const conn = getVoiceConnection(guild.id);
  const connReady = conn?.state?.status === "ready";
  const me = guild.members.me;
  const botVoiceId = me?.voice?.channelId || null;
  return !!(connReady && botVoiceId && channelId && botVoiceId === channelId);
}

export async function ensureConnected(channel: VoiceBasedChannel) {
  let conn = getVoiceConnection(channel.guild.id);
  if (!conn) {
    conn = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator as any,
      selfDeaf: false,
      selfMute: false,
    });
    attachConnDebug(conn);
  }

  const start = Date.now();
  await new Promise<void>((resolve, reject) => {
    let resolved = false;
    const onState = () => {
      if (conn!.state.status === "ready") {
        resolved = true;
        cleanup();
        return resolve();
      }
    };
    const timeout = setTimeout(() => {
      if (!resolved) {
        cleanup();
        return reject(
          new Error("Voice connection timeout (not ready)")
        );
      }
    }, 7000);

    const cleanup = () => {
      conn?.off("stateChange", onState);
      clearTimeout(timeout);
    };

    conn?.on("stateChange", onState);
    onState();
  }).catch((e) => {
    console.warn("[voice] primeira tentativa falhou:", e.message);
  });

  if (conn.state.status !== "ready") {
    try {
      conn.destroy();
    } catch {}
    const retry = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator as any,
      selfDeaf: false,
      selfMute: false,
    });
    attachConnDebug(retry);
    await new Promise((r) => setTimeout(r, 1500));
  }
}