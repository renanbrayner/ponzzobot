import { EndBehaviorType, getVoiceConnection } from "@discordjs/voice";
import { Guild } from "discord.js";
import prism from "prism-media";
import { processFrame, resetRms, resetVad, pushRms } from "./vad";
import { clearKick, eligibleForKick, userTimeoutMultipliers, userFirstKick } from "./kick";

const receiverInitialized = new Set<string>();

export function setupReceiverForGuild(guild: Guild) {
  const conn = getVoiceConnection(guild.id);
  if (!conn) {
    console.log(`[receiver] Sem conexão em ${guild.name}`);
    return;
  }
  if (receiverInitialized.has(guild.id)) return;
  if (conn.state.status !== "ready") {
    conn.once("stateChange", (_o, n) => {
      if (n.status === "ready") setTimeout(() => setupReceiverForGuild(guild), 300);
    });
    return;
  }

  receiverInitialized.add(guild.id);
  const receiver = conn.receiver;

  receiver.speaking.on("start", (userId) => {
    const member = guild.members.cache.get(userId);
    if (member?.voice?.channel) {
      console.log(`[speaking.start] ${member.displayName}`);
    }
    let opusStream: any;
    try {
      opusStream = receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 600 },
      });
    } catch (e) {
      console.error("[receiver.subscribe] falhou:", e);
      return;
    }

    let pcmStream: any;
    try {
      pcmStream = opusStream.pipe(
        new prism.opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 })
      );
    } catch (e) {
      console.error("[opus.Decoder] falhou:", e);
      try {
        opusStream.destroy();
      } catch {}
      return;
    }

    // Adicionar tratamento de erros no opusStream também
    opusStream.on("error", (err: any) => {
      // Silenciar erros de rede que são comuns
      if (err.message && (
        err.message.includes("compressed data passed is corrupted") ||
        err.message.includes("socket") ||
        err.message.includes("network")
      )) {
        return;
      }
      console.error("[opusStream] erro inesperado:", err);
    });

    let lastVadLog = 0;

    pcmStream.on("data", (chunk: Buffer) => {
      const view = new Int16Array(
        chunk.buffer,
        chunk.byteOffset,
        chunk.byteLength / 2
      );
      let sum = 0;
      let count = 0;
      for (let i = 0; i < view.length; i += 2) {
        const v = view[i];
        sum += v * v;
        count++;
      }
      const rms = Math.sqrt(sum / Math.max(1, count));
      const now = Date.now();
      const avgRms = pushRms(userId, rms);

      if (now - lastVadLog > 500) {
        lastVadLog = now;
        const m = guild.members.cache.get(userId);
        if (m) console.log(`[VADDBG] ${m.displayName} avgRMS=${Math.round(avgRms)}`);
      }

      processFrame({
        userId,
        avgRms,
        now,
        onConfirm: () => {
          clearKick(userId);
          if (eligibleForKick.get(userId) === true) {
            eligibleForKick.set(userId, false);

            // Resetar penalidade do usuário pois ele falou com sucesso
            const hadPenalty = userTimeoutMultipliers.has(userId);
            userTimeoutMultipliers.delete(userId);
            userFirstKick.delete(userId); // Resetar primeira vez também

            const m = guild.members.cache.get(userId);
            if (m) {
              const penaltyMsg = hadPenalty ? " - penalidade resetada" : "";
              console.log(`[VAD] ${m.displayName} confirmado: cancelando kick${penaltyMsg}`);
            }
          }
        },
      });
    });

    pcmStream.on("end", () => {
      resetVad(userId);
      resetRms(userId);
    });

    pcmStream.on("error", (err: any) => {
      // Silenciar erros comuns de decoder Opus que são esperados com as novas versões
      if (err.message && err.message.includes("compressed data passed is corrupted")) {
        // Erro comum quando o Discord envia pacotes corrompidos ou incompletos
        // Não precisa logar como erro - é comportamento esperado
        return;
      }

      // Logar apenas outros erros inesperados
      console.error("[pcmStream] erro inesperado:", err);

      // Tentar destruir streams para evitar vazamentos
      try {
        pcmStream.destroy();
      } catch {}
      try {
        opusStream.destroy();
      } catch {}
    });
  });

  receiver.speaking.on("end", (userId) => {
    resetVad(userId);
    resetRms(userId);
    const member = guild.members.cache.get(userId);
    if (member?.voice?.channel) {
      console.log(`[speaking.end] ${member.displayName}`);
    }
  });

  // @ts-ignore - error event pode não estar tipado
  receiver.speaking.on("error", (err) => {
    console.error("[receiver.speaking] erro:", err);
  });

  console.log(`[receiver] Ativado para ${guild.name}`);
}