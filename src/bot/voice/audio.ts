import {
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  AudioPlayerStatus,
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
  player.on(AudioPlayerStatus.Idle, () => player.stop());
  console.log(`[audio] tocando contagem.ogg em ${guild.name}`);
}