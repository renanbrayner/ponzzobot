Objetivo
Migrar o projeto atual de bot Discord (Node.js + JavaScript) para TypeScript (Node 20/22 LTS), mantendo a funcionalidade e modularizando o código. O projeto usa discord.js v14, @discordjs/voice, prism-media, @discordjs/opus (ou opusscript), e FFmpeg para tocar .ogg.

Tarefas
1) Configurar TypeScript e tooling
2) Organizar a estrutura em módulos (commands, voice, VAD, kick, audio, connection, events)
3) Converter o código para TS com tipagem adequada
4) Ajustar scripts de execução (dev/build/start)
5) Garantir compatibilidade com módulos nativos e FFmpeg
6) Preservar a lógica atual (eligibilidade, VAD, schedule, checagem de canal, áudio)

Passo a passo detalhado

1) Dependências de desenvolvimento
- Adicionar TypeScript e ferramentas:
```bash
npm install -D typescript ts-node ts-node-dev @types/node
# ou pnpm/yarn conforme o projeto
```

2) tsconfig.json
- Crie um arquivo tsconfig.json com NodeNext (ESM) e ES2022:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

3) Estrutura de pastas (migre do arquivo único para módulos)
Crie esta estrutura e mova o conteúdo JS para TS nas respectivas áreas. Use os nomes dos arquivos abaixo e distribua as funções equivalentes do seu código atual:

- src/
  - index.ts
  - config.ts
  - logger.ts (opcional)
  - bot/
    - client.ts
    - commands/
      - index.ts
      - entrar.ts
      - sair.ts
    - voice/
      - connection.ts
      - audio.ts
      - vad.ts
      - receiver.ts
      - kick.ts
  - events/
    - messageCreate.ts
    - voiceStateUpdate.ts
- assets/contagem.ogg
- .env, .env.example

4) Conteúdo dos módulos (exemplos com tipagem)

4.1) src/config.ts
- Centralize variáveis de ambiente e constantes
```ts
import path from "node:path";

export const CFG = {
  INACTIVITY_TIMEOUT: parseInt(process.env.INACTIVITY_TIMEOUT || "2000", 10),
  VAD_FLOOR: parseInt(process.env.VAD_FLOOR || "800", 10),
  VAD_THRESHOLD: parseInt(process.env.VAD_THRESHOLD || "2500", 10),
  VAD_SUSTAIN_MS: parseInt(process.env.VAD_SUSTAIN_MS || "150", 10),
  VAD_COOLDOWN_MS: parseInt(process.env.VAD_COOLDOWN_MS || "300", 10),
  VAD_THRESHOLD_STRONG: parseInt(
    process.env.VAD_THRESHOLD_STRONG || "6000",
    10
  ),
  COUNTDOWN_PATH: path.resolve(process.cwd(), "assets/contagem.ogg"),
};
```

4.2) src/bot/client.ts
- Cria e exporta o Client tipado com intents/partials
```ts
import {
  Client,
  GatewayIntentBits,
  Partials,
} from "discord.js";

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.GuildMember],
});
```

4.3) src/bot/voice/connection.ts
- Funções de conexão, debug e checagem do canal do bot
```ts
import {
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnection,
} from "@discordjs/voice";
import { Guild, VoiceBasedChannel } from "discord.js";

export function attachConnDebug(conn?: VoiceConnection) {
  if (!conn) return;
  conn.on("stateChange", (oldS, newS) => {
    console.log(`[voice] conn state: ${oldS.status} -> ${newS.status}`);
  });
  // networking listener é opcional; pode variar por versão
  // @ts-ignore
  const net = (conn.state as any)?.networking;
  if (net) {
    net.on("stateChange", (oldN: any, newN: any) => {
      console.log(`[voice] net state: ${oldN.status} -> ${newN.status}`);
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
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });
    attachConnDebug(conn);
  }

  await new Promise<void>((resolve, reject) => {
    let resolved = false;
    const onState = () => {
      if (conn!.state.status === "ready") {
        cleanup();
        resolved = true;
        resolve();
      }
    };
    const timeout = setTimeout(() => {
      if (!resolved) {
        cleanup();
        reject(new Error("Voice connection timeout (not ready)"));
      }
    }, 7000);
    const cleanup = () => {
      conn?.off("stateChange", onState);
      clearTimeout(timeout);
    };
    conn?.on("stateChange", onState);
    onState();
  }).catch(() => {});

  if (conn.state.status !== "ready") {
    try {
      conn.destroy();
    } catch {}
    const retry = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });
    attachConnDebug(retry);
    await new Promise((r) => setTimeout(r, 1500));
  }
}
```

4.4) src/bot/voice/audio.ts
- Tocar contagem.ogg quando o schedule inicia
```ts
import {
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
} from "@discordjs/voice";
import { Guild } from "discord.js";
import { CFG } from "../../config";

export function playCountdownOnce(guild: Guild) {
  const conn = getVoiceConnection(guild.id);
  if (!conn) return;
  const player = createAudioPlayer();
  const resource = createAudioResource(CFG.COUNTDOWN_PATH);
  player.play(resource);
  conn.subscribe(player);
  player.on("idle", () => player.stop());
  console.log(`[audio] tocando contagem.ogg em ${guild.name}`);
}
```

4.5) src/bot/voice/vad.ts
- Estado, média móvel e decisão de fala (floor/threshold/sustain/ratio/fast path)
```ts
import { CFG } from "../../config";

type VadState = {
  startMs: number;
  lastAbove: number;
  cooldownUntil: number;
  framesAbove: number;
  framesTotal: number;
};
const vadState = new Map<string, VadState>();
const rmsHist = new Map<string, number[]>();

export function resetVad(userId: string) {
  vadState.delete(userId);
}
export function resetRms(userId: string) {
  rmsHist.delete(userId);
}

function getVad(userId: string): VadState {
  let s = vadState.get(userId);
  if (!s) {
    s = {
      startMs: 0,
      lastAbove: 0,
      cooldownUntil: 0,
      framesAbove: 0,
      framesTotal: 0,
    };
    vadState.set(userId, s);
  }
  return s;
}

export function pushRms(userId: string, rms: number, n = 3): number {
  let arr = rmsHist.get(userId);
  if (!arr) arr = [];
  arr.push(rms);
  if (arr.length > n) arr.shift();
  rmsHist.set(userId, arr);
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function processFrame(params: {
  userId: string;
  avgRms: number;
  now: number;
  onConfirm: () => void;
  onDebug?: (m: string) => void;
}) {
  const { userId, avgRms, now, onConfirm, onDebug } = params;
  const st = getVad(userId);

  if (st.cooldownUntil && now < st.cooldownUntil) return;

  if (avgRms >= CFG.VAD_THRESHOLD_STRONG) {
    onConfirm();
    st.cooldownUntil = now + CFG.VAD_COOLDOWN_MS;
    st.startMs = 0;
    st.lastAbove = 0;
    st.framesAbove = 0;
    st.framesTotal = 0;
    resetRms(userId);
    return;
  }

  if (avgRms < CFG.VAD_FLOOR) {
    st.startMs = 0;
    st.lastAbove = 0;
    st.framesAbove = 0;
    st.framesTotal = 0;
    return;
  }

  if (avgRms >= CFG.VAD_FLOOR && avgRms < CFG.VAD_THRESHOLD) {
    st.framesTotal++;
    st.lastAbove = 0;
    return;
  }

  if (avgRms >= CFG.VAD_THRESHOLD) {
    if (!st.startMs) {
      st.startMs = now;
      st.framesAbove = 0;
      st.framesTotal = 0;
    }
    st.lastAbove = now;
    st.framesTotal++;
    st.framesAbove++;

    const sustained = now - st.startMs;
    const ratio =
      st.framesTotal > 0 ? st.framesAbove / st.framesTotal : 0;

    if (sustained >= CFG.VAD_SUSTAIN_MS && ratio >= 0.5) {
      onConfirm();
      st.cooldownUntil = now + CFG.VAD_COOLDOWN_MS;
      st.startMs = 0;
      st.lastAbove = 0;
      st.framesAbove = 0;
      st.framesTotal = 0;
      resetRms(userId);
    }
  }
}
```

4.6) src/bot/voice/receiver.ts
- Subscribe/decoder e integração com VAD
```ts
import { EndBehaviorType, getVoiceConnection } from "@discordjs/voice";
import { Guild } from "discord.js";
import prism from "prism-media";
import { processFrame, resetRms, resetVad, pushRms } from "./vad";
import { clearKick, eligibleForKick } from "./kick";

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
            const m = guild.members.cache.get(userId);
            if (m) console.log(`[VAD] ${m.displayName} confirmado: cancelando kick`);
          }
        },
      });
    });

    pcmStream.on("end", () => {
      resetVad(userId);
      resetRms(userId);
    });

    pcmStream.on("error", (err: any) => {
      console.error("[pcmStream] erro:", err);
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

  receiver.speaking.on("error", (err) => {
    console.error("[receiver.speaking] erro:", err);
  });

  console.log(`[receiver] Ativado para ${guild.name}`);
}
```

4.7) src/bot/voice/kick.ts
- Elegibilidade e timeout com revalidações; integra com áudio
```ts
import { GuildMember, VoiceBasedChannel } from "discord.js";
import { CFG } from "../../config";
import { botInSameVoiceChannelNow } from "./connection";
import { playCountdownOnce } from "./audio";

export const pendingKicks = new Map<string, NodeJS.Timeout>();
export const eligibleForKick = new Map<string, boolean>();

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
      console.log(
        `Kick: ${member.displayName} por inatividade (${CFG.INACTIVITY_TIMEOUT}ms)`
      );
    } catch (e) {
      console.error(`Erro ao kickar ${member.displayName}:`, e);
    } finally {
      pendingKicks.delete(member.id);
      eligibleForKick.delete(member.id);
    }
  }, CFG.INACTIVITY_TIMEOUT);

  pendingKicks.set(member.id, id);
  console.log(
    `Agendado kick para ${member.displayName} em ${CFG.INACTIVITY_TIMEOUT}ms`
  );
}
```

4.8) src/events/voiceStateUpdate.ts
- Coordena entrada/mudança/saída de usuários e do próprio bot
```ts
import { VoiceState } from "discord.js";
import { eligibleForKick, clearKick, scheduleKick } from "../bot/voice/kick";
import { botInSameVoiceChannelNow } from "../bot/voice/connection";
import { setupReceiverForGuild } from "../bot/voice/receiver";

export function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  // usuário entrou
  if (!oldState.channelId && newState.channelId) {
    eligibleForKick.set(member.id, true);
    console.log(`[eligibility] ${member.displayName} elegível=true (entrou)`);
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
  }

  // próprio bot movido/desconectado: limpe timeouts
  const isSelf =
    newState.id === newState.client.user?.id ||
    oldState.id === oldState.client.user?.id;
  if (isSelf) {
    if (oldState.channelId && !newState.channelId) {
      console.log("[bot] saiu do canal; cancelando timeouts");
      for (const [userId, t] of Array.from((global as any).pendingKicks ?? [])) {
        clearTimeout(t);
        (global as any).pendingKicks.delete(userId);
        (global as any).eligibleForKick?.delete(userId);
      }
    }
    if (
      oldState.channelId &&
      newState.channelId &&
      oldState.channelId !== newState.channelId
    ) {
      console.log("[bot] mudou de canal; cancelando timeouts");
      for (const [userId, t] of Array.from((global as any).pendingKicks ?? [])) {
        clearTimeout(t);
        (global as any).pendingKicks.delete(userId);
        (global as any).eligibleForKick?.delete(userId);
      }
    }
  }
}
```

4.9) src/events/messageCreate.ts
- Comandos !entrar e !sair
```ts
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
```

4.10) src/index.ts
- Bootstrap
```ts
import "dotenv/config";
import { Events } from "discord.js";
import { client } from "./bot/client";
import { onMessageCreate } from "./events/messageCreate";
import { onVoiceStateUpdate } from "./events/voiceStateUpdate";

client.once(Events.ClientReady, (c) => {
  console.log(`Bot ${c.user.tag} online`);
  console.log(`Em ${c.guilds.cache.size} servidores:`);
  c.guilds.cache.forEach((g) => console.log(`- ${g.name} (${g.id})`));
});

client.on(Events.MessageCreate, onMessageCreate);
client.on(Events.VoiceStateUpdate, onVoiceStateUpdate);

client.login(process.env.DISCORD_TOKEN);
```

5) Scripts no package.json
- Adicione scripts de dev/build/start:
```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  }
}
```

6) Tipos e compatibilidades
- Mantenha @discordjs/opus instalado para melhor performance de decodificação Opus:
```bash
npm install @discordjs/opus
```
- FFmpeg deve estar instalado no sistema para tocar .ogg. Alternativamente, converta para WAV PCM 48kHz.
- Se houver qualquer queixa de tipo em joinConfig.channelId, use `// @ts-ignore` pontualmente ou promova wrappers com tipos próprios.

7) Checklist de migração
- Mover lógicas do arquivo único para os módulos descritos.
- Converter require() para import.
- Tipar parâmetros e retornos nas funções principais.
- Preservar a lógica: elegibilidade (falou uma vez → livre), VAD com sustain e floor/threshold, schedule com checagens no agendamento e no disparo, e tocar contagem.ogg apenas ao iniciar o schedule.
- Testar com Node 20/22, @discordjs/opus instalado e FFmpeg no PATH.

8) Resultados esperados
- Código modular, com separação clara de responsabilidades.
- Tipagem que ajuda a prevenir erros (ex.: comparar canal do bot no disparo).
- Mesma funcionalidade do JS original (com os ajustes recentes), agora em TS.

Aplique a migração conforme acima, criando os arquivos, movendo o código para os módulos e ajustando imports/exports. Em seguida, rode:
- npm run dev (ambiente de desenvolvimento)
- npm run build && npm start (produção)
