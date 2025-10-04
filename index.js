/* Instruções rápidas:
1) Habilite "MESSAGE CONTENT INTENT" no Developer Portal (Bot > Privileged Intents).
2) Crie .env baseado em .env.example.
3) npm install discord.js @discordjs/voice prism-media dotenv
4) node index.js
Permissões: o bot precisa de "Move Members" para desconectar membros do canal.
*/

require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Events,
  Partials,
} = require("discord.js");
const {
  joinVoiceChannel,
  getVoiceConnection,
  EndBehaviorType,
  createAudioPlayer,
  createAudioResource,
} = require("@discordjs/voice");
const prism = require("prism-media");

const INACTIVITY_TIMEOUT =
  parseInt(process.env.INACTIVITY_TIMEOUT, 10) || 2000;
const VAD_THRESHOLD = parseInt(process.env.VAD_THRESHOLD, 10) || 2500;
// abaixo disso é ruído de piso (ignorar totalmente)
const VAD_FLOOR = parseInt(process.env.VAD_FLOOR, 10) || 800;
// tempo contínuo acima do THRESHOLD para confirmar fala
const VAD_SUSTAIN_MS = parseInt(process.env.VAD_SUSTAIN_MS, 10) || 150;
// cooldown pós-confirmação para evitar jitter
const VAD_COOLDOWN_MS = parseInt(process.env.VAD_COOLDOWN_MS, 10) || 300;
// fast path para fala muito forte (cancela imediatamente)
const VAD_THRESHOLD_STRONG = parseInt(process.env.VAD_THRESHOLD_STRONG, 10) || 6000;
/*
VAD - Detecção de Fala Avançada
VAD_FLOOR: Abaixo disso é ruído ignorado (padrão: 800)
VAD_THRESHOLD: Acima disso é potencial fala (padrão: 2500)
VAD_SUSTAIN_MS: Tempo contínuo acima do threshold para confirmar (padrão: 200ms)
VAD_COOLDOWN_MS: Tempo após confirmação para evitar oscilações (padrão: 300ms)

Ajuste no .env baseado nos logs [VAD] que mostram valores RMS detectados
*/

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.GuildMember],
});

const pendingKicks = new Map(); // userId -> timeoutId
const receiverInitialized = new Set(); // guildId com receiver configurado
const eligibleForKick = new Map(); // userId -> boolean

// Estado VAD por usuário (por guild)
const vadState = new Map(); // userId -> { startMs, lastAbove, cooldownUntil, framesAbove, framesTotal }

function getVad(userId) {
  let s = vadState.get(userId);
  if (!s) {
    s = { startMs: 0, lastAbove: 0, cooldownUntil: 0, framesAbove: 0, framesTotal: 0 };
    vadState.set(userId, s);
  }
  return s;
}

function resetVad(userId) {
  vadState.delete(userId);
}

// Média móvel RMS com 3 frames
const vadRmsHist = new Map(); // userId -> number[]
function pushRms(userId, rms, n = 3) {
  let arr = vadRmsHist.get(userId);
  if (!arr) arr = [];
  arr.push(rms);
  if (arr.length > n) arr.shift();
  vadRmsHist.set(userId, arr);
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return avg;
}
function resetRms(userId) {
  vadRmsHist.delete(userId);
}

function logConnState(conn, label = "") {
  try {
    const s = conn?.state;
    const net = s?.networking?.state;
    const tx = net?.udp?.state;
    const ws = net?.ws?.state;
    console.log(
      `[voice] ${label} status=${s?.status} ws=${ws?.status} udp=${tx?.status}`
    );
  } catch (e) {
    console.log("[voice] erro ao inspecionar estado:", e);
  }
}

function attachConnDebug(conn) {
  if (!conn) return;
  conn.on("stateChange", (oldS, newS) => {
    console.log(`[voice] conn state: ${oldS.status} -> ${newS.status}`);
  });
  const net = conn.state.networking;
  if (net) {
    net.on("stateChange", (oldN, newN) => {
      console.log(
        `[voice] net state: ${oldN.status} -> ${newN.status}`
      );
    });
  }
}

client.once(Events.ClientReady, (c) => {
  console.log(`Bot ${c.user.tag} online`);
  console.log(`Em ${c.guilds.cache.size} servidores:`);
  c.guilds.cache.forEach((g) =>
    console.log(`- ${g.name} (${g.id})`)
  );
});

function clearKick(userId) {
  const t = pendingKicks.get(userId);
  if (t) {
    clearTimeout(t);
    pendingKicks.delete(userId);
  }
}

function scheduleKick(member, channel) {
  clearKick(member.id);

  // Debug: verificar timeouts duplicados
  if (pendingKicks.has(member.id)) {
    console.log(`[debug] timeout já existe para ${member.displayName}`);
  }

  // Deve estar elegível para agendar
  if (eligibleForKick.get(member.id) !== true) {
    console.log(
      `[skip] ${member.displayName} não é elegível para kick (não agendando)`
    );
    return;
  }

  // Bot deve estar no mesmo canal
  const conn = getVoiceConnection(channel.guild.id);
  const botInSameChannel =
    conn && conn.joinConfig.channelId === channel.id;
  if (!botInSameChannel) {
    console.log(
      `[skip] Não agendando kick para ${member.displayName} - Bot fora de ${channel.name}`
    );
    return;
  }

  // Toca o áudio de contagem ao efetivamente agendar o kick
  try {
    const player = createAudioPlayer();
    const resource = createAudioResource('./assets/contagem.ogg');

    player.play(resource);
    conn.subscribe(player);

    console.log(`[audio] Tocando contagem.ogg para ${member.displayName}`);

    // Limpa o player após o áudio terminar (para não ocupar recursos)
    player.on('idle', () => {
      player.stop();
    });

  } catch (error) {
    console.error('[audio] Erro ao tocar contagem.ogg:', error);
  }

  const id = setTimeout(async () => {
    try {
      // 1) Se ficou inelegível (falou em qualquer momento), não kicar
      if (eligibleForKick.get(member.id) !== true) {
        console.log(
          `[kick-cancel] ${member.displayName} inelegível antes do timeout`
        );
        return;
      }

      // 2) Revalidar se o bot ainda está no mesmo canal do usuário
      const connNow = getVoiceConnection(channel.guild.id);
      const botStillInSameChannel =
        connNow && connNow.joinConfig.channelId === channel.id;

      if (!botStillInSameChannel) {
        console.log(
          `[skip] Timeout: bot não está no canal ${channel.name}; não vou kickar ${member.displayName}`
        );
        return;
      }

      // 3) Verificar se o usuário ainda está no mesmo canal
      const stillHere =
        member.voice?.channel && member.voice.channelId === channel.id;

      if (!stillHere) {
        console.log(
          `[skip] ${member.displayName} já não está mais no canal no disparo`
        );
        return;
      }

      // 4) Finalmente, desconectar (Move Members necessário)
      await member.voice.disconnect();
      console.log(
        `Kick: ${member.displayName} por inatividade de fala (${INACTIVITY_TIMEOUT}ms)`
      );
    } catch (e) {
      console.error(`Erro ao kickar ${member.displayName}:`, e);
    } finally {
      pendingKicks.delete(member.id);
      eligibleForKick.delete(member.id);
    }
  }, INACTIVITY_TIMEOUT);

  pendingKicks.set(member.id, id);
  console.log(
    `Agendado kick para ${member.displayName} em ${INACTIVITY_TIMEOUT}ms`
  );
}

async function ensureConnected(voiceChannel) {
  let conn = getVoiceConnection(voiceChannel.guild.id);
  if (!conn) {
    conn = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });
    attachConnDebug(conn);
  }

  const start = Date.now();
  await new Promise((resolve, reject) => {
    let resolved = false;
    const onState = () => {
      if (conn.state.status === "ready") {
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
      conn.off("stateChange", onState);
      clearTimeout(timeout);
    };

    conn.on("stateChange", onState);
    // checagem imediata
    onState();
  }).catch((e) => {
    console.warn("[voice] primeira tentativa falhou:", e.message);
  });

  if (conn.state.status !== "ready") {
    // força reconectar
    try {
      conn.destroy();
    } catch {}
    const retry = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });
    attachConnDebug(retry);
    // esperar um pouco
    await new Promise((r) => setTimeout(r, 1500));
  }
}

function setupReceiverForGuild(guild) {
  const conn = getVoiceConnection(guild.id);
  if (!conn) {
    console.log(
      `[receiver] Sem conexão no guild ${guild.name}; não é possível receber áudio`
    );
    return;
  }
  if (receiverInitialized.has(guild.id)) return;

  logConnState(conn, "setupReceiver");

  // Aguarda a conexão estar pronta antes de configurar receiver
  if (conn.state.status !== "ready") {
    console.log(
      `[receiver] Conexão não está pronta (${conn.state.status}); aguardando...`
    );
    conn.once("stateChange", (oldState, newState) => {
      if (newState.status === "ready") {
        setTimeout(() => setupReceiverForGuild(guild), 300);
      }
    });
    return;
  }

  receiverInitialized.add(guild.id);

  const receiver = conn.receiver;

  // speaking.start: frames opus chegando
  receiver.speaking.on("start", (userId) => {
    const member = guild.members.cache.get(userId);
    if (member?.voice?.channel) {
      console.log(
        `[speaking.start] ${member.displayName} começou a transmitir`
      );
      // Não cancelar aqui. Deixe o VAD decidir.
      // speaking.start só indica que estão chegando frames,
      // não que houve fala suficientemente forte/sustentada.
    }
  });

  receiver.speaking.on("end", (userId) => {
    resetVad(userId); // zera janela/histerese ao fim de fala
    resetRms(userId); // zera histórico RMS
    const member = guild.members.cache.get(userId);
    if (member?.voice?.channel) {
      console.log(
        `[speaking.end] ${member.displayName} parou de transmitir`
      );
      // Não reagendar aqui. Regra: falou uma vez -> livre até sair/mudar de canal.
    }
  });

  receiver.speaking.on("error", (err) => {
    console.error("[receiver.speaking] erro:", err);
  });

  // VAD simplificado via RMS
  receiver.speaking.on("start", (userId) => {
    let opusStream;
    try {
      opusStream = receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 600 },
      });
    } catch (e) {
      console.error("[receiver.subscribe] falhou:", e);
      return;
    }

    let pcmStream;
    try {
      pcmStream = opusStream.pipe(
        new prism.opus.Decoder({
          frameSize: 960,
          channels: 2,
          rate: 48000,
        })
      );
    } catch (e) {
      console.error("[opus.Decoder] falhou (instale @discordjs/opus):", e);
      try {
        opusStream.destroy();
      } catch {}
      return;
    }

    let lastLog = 0;

      let lastVadLog = 0;

    pcmStream.on("data", (chunk) => {
      const view = new Int16Array(
        chunk.buffer,
        chunk.byteOffset,
        chunk.byteLength / 2
      );

      // RMS do canal esquerdo
      let sum = 0;
      let count = 0;
      for (let i = 0; i < view.length; i += 2) {
        const v = view[i];
        sum += v * v;
        count++;
      }
      const rms = Math.sqrt(sum / Math.max(1, count));
      const now = Date.now();

      const st = getVad(userId);
      const avgRms = pushRms(userId, rms); // média móvel 3 frames

      // cooldown
      if (st.cooldownUntil && now < st.cooldownUntil) return;

      // Logs limitados para calibração (a cada 500ms)
      if (now - lastVadLog > 500) {
        lastVadLog = now;
        const m = guild.members.cache.get(userId);
        if (m) console.log(`[VADDBG] ${m.displayName} avgRMS=${Math.round(avgRms)}`);
      }

      // Fast path: fala muito forte e curta
      if (avgRms >= VAD_THRESHOLD_STRONG) {
        clearKick(userId);
        if (eligibleForKick.get(userId) === true) {
          eligibleForKick.set(userId, false);
          const m = guild.members.cache.get(userId);
          if (m) {
            console.log(
              `[VAD] ${m.displayName} fast-confirm (avgRMS=${Math.round(
                avgRms
              )} >= ${VAD_THRESHOLD_STRONG})`
            );
          }
        }
        resetRms(userId);
        const st = getVad(userId);
        st.cooldownUntil = now + VAD_COOLDOWN_MS;
        st.startMs = 0;
        st.lastAbove = 0;
        st.framesAbove = 0;
        st.framesTotal = 0;
        return;
      }

      // abaixo do piso (use a média para decidir)
      if (avgRms < VAD_FLOOR) {
        st.startMs = 0;
        st.lastAbove = 0;
        st.framesAbove = 0;
        st.framesTotal = 0;
        return;
      }

      // entre piso e threshold
      if (avgRms >= VAD_FLOOR && avgRms < VAD_THRESHOLD) {
        // conta como frame válido, mas não "acima"
        st.framesTotal++;
        st.lastAbove = 0;
        // se ficou só nesse patamar, não confirma
        return;
      }

      // acima do threshold
      if (avgRms >= VAD_THRESHOLD) {
        if (!st.startMs) {
          st.startMs = now;
          st.framesAbove = 0;
          st.framesTotal = 0;
        }
        st.lastAbove = now;
        st.framesTotal++;
        st.framesAbove++;

        const sustained = now - st.startMs;

        // proporção mínima de frames acima do threshold
        const ratio = st.framesTotal > 0 ? st.framesAbove / st.framesTotal : 0;

        if (sustained >= VAD_SUSTAIN_MS && ratio >= 0.5) {
          clearKick(userId);
          if (eligibleForKick.get(userId) === true) {
            eligibleForKick.set(userId, false);
            const m = guild.members.cache.get(userId);
            if (m) {
              console.log(
                `[VAD] ${m.displayName} confirmado: avgRMS=${Math.round(
                  avgRms
                )}, sustain=${sustained}ms, ratio=${(ratio * 100).toFixed(
                  0
                )}%`
              );
            }
          }
          st.cooldownUntil = now + VAD_COOLDOWN_MS;
          st.startMs = 0;
          st.lastAbove = 0;
          st.framesAbove = 0;
          st.framesTotal = 0;
          resetRms(userId);
        }
      }
    });

    pcmStream.on("end", () => {
      resetVad(userId);
      resetRms(userId);
    });

    pcmStream.on("error", (err) => {
      console.error("[pcmStream] erro:", err);
    });
  });

  console.log(`[receiver] Ativado para ${guild.name}`);
}

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member || member.user?.bot) return;

  // entrou
  if (!oldState.channelId && newState.channelId) {
    const member = newState.member;
    eligibleForKick.set(member.id, true);
    console.log(
      `[eligibility] ${member.displayName} elegível=true (entrou)`
    );
    console.log(
      `${member.displayName} entrou em ${newState.channel?.name}`
    );
    scheduleKick(member, newState.channel);

    // tenta configurar receiver se o bot já está no guild
    setImmediate(() => setupReceiverForGuild(newState.guild));
  }

  // mudou
  if (
    oldState.channelId &&
    newState.channelId &&
    oldState.channelId !== newState.channelId
  ) {
    const member = newState.member;
    clearKick(member.id);
    eligibleForKick.set(member.id, true);
    console.log(
      `[eligibility] ${member.displayName} elegível=true (mudou de canal)`
    );
    console.log(
      `${member.displayName} moveu-se para ${newState.channel?.name}`
    );
    scheduleKick(member, newState.channel);
    setImmediate(() => setupReceiverForGuild(newState.guild));
  }

  // saiu
  if (oldState.channelId && !newState.channelId) {
    const member = oldState.member;
    clearKick(member.id);
    eligibleForKick.delete(member.id);
    resetVad(member.id);
    resetRms(member.id);
    console.log(
      `[eligibility] ${member.displayName} removido (saiu do canal)`
    );
    console.log(`${member.displayName} saiu do canal`);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.guild || message.author.bot) return;

  if (message.content === "!entrar") {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply(
        "Entre em um canal de voz para usar este comando."
      );
    }

    const existing = getVoiceConnection(message.guild.id);
    if (existing) {
      const current =
        message.guild.channels.cache.get(
          existing.joinConfig.channelId
        )?.name || "desconhecido";
      return message.reply(
        `Já estou conectado (canal: ${current}).`
      );
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
          conn.joinConfig.channelId
        )?.name || "desconhecido";
      conn.destroy();
      // limpamos o receiver flag para permitir nova inicialização
      receiverInitialized.delete(message.guild.id);

      // Cancela timeouts pendentes já que o bot saiu do canal
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
});

process.on("unhandledRejection", (r) => {
  console.error("UnhandledRejection:", r);
});
process.on("uncaughtException", (e) => {
  console.error("UncaughtException:", e);
});

client.login(process.env.DISCORD_TOKEN);