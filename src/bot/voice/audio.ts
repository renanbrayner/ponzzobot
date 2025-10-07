import {
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  AudioPlayerStatus,
} from "@discordjs/voice";
import { Guild } from "discord.js";
import { CFG } from "../../config";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Obtém um arquivo de áudio aleatório de um diretório
 */
function getRandomAudioFile(directory: string): string | null {
  try {
    if (!fs.existsSync(directory)) {
      console.error(`[audio] diretório não existe: ${directory}`);
      return null;
    }

    const files = fs.readdirSync(directory)
      .filter(file => file.endsWith('.ogg'))
      .filter(file => fs.statSync(path.join(directory, file)).isFile());

    if (files.length === 0) {
      console.error(`[audio] nenhum arquivo .ogg encontrado em: ${directory}`);
      return null;
    }

    const randomFile = files[Math.floor(Math.random() * files.length)];
    return path.join(directory, randomFile);
  } catch (error) {
    console.error(`[audio] erro ao ler diretório ${directory}:`, error);
    return null;
  }
}

/**
 * Toca um áudio específico em um servidor
 */
function playAudioFile(guild: Guild, audioPath: string, audioType: string = "áudio") {
  const conn = getVoiceConnection(guild.id);
  if (!conn) {
    console.log(`[audio] sem conexão em ${guild.name}`);
    return;
  }

  if (!fs.existsSync(audioPath)) {
    console.error(`[audio] arquivo não existe: ${audioPath}`);
    return;
  }

  try {
    const player = createAudioPlayer();
    const resource = createAudioResource(audioPath);
    player.play(resource);
    conn.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => player.stop());

    const fileName = path.basename(audioPath);
    console.log(`[audio] tocando ${audioType} (${fileName}) em ${guild.name}`);
  } catch (error) {
    console.error(`[audio] erro ao tocar ${audioType}:`, error);
  }
}

/**
 * Toca áudio de kick (primeira vez contagem, depois aleatório)
 */
export function playKickAudio(guild: Guild, isFirstTime: boolean = false) {
  if (isFirstTime) {
    // Primeira vez sempre usa contagem.ogg
    playAudioFile(guild, CFG.COUNTDOWN_AUDIO, "contagem");
  } else {
    // Segundas vezes usa áudio aleatório
    const randomAudio = getRandomAudioFile(CFG.KICK_VOICES_DIR);
    if (randomAudio) {
      playAudioFile(guild, randomAudio, "kick aleatório");
    } else {
      // Fallback para contagem se não encontrar aleatório
      playAudioFile(guild, CFG.COUNTDOWN_AUDIO, "contagem (fallback)");
    }
  }
}

/**
 * Toca áudio aleatório de lero-lero
 */
export function playLeroLeroAudio(guild: Guild) {
  const randomAudio = getRandomAudioFile(CFG.LERO_LERO_VOICES_DIR);
  if (randomAudio) {
    playAudioFile(guild, randomAudio, "lero-lero aleatório");
  } else {
    console.error(`[audio] nenhum áudio de lero-lero encontrado`);
  }
}

/**
 * Legado: mantida para compatibilidade
 * @deprecated Usar playKickAudio() em vez desta função
 */
export function playCountdownOnce(guild: Guild) {
  playKickAudio(guild, true);
}