import path from "node:path";

export const CFG = {
  INACTIVITY_TIMEOUT: parseInt(process.env.INACTIVITY_TIMEOUT || "2000", 10),
  USER_TIMEOUT_INCREMENT: parseInt(process.env.USER_TIMEOUT_INCREMENT || "500", 10),
  VAD_FLOOR: parseInt(process.env.VAD_FLOOR || "1200", 10),
  VAD_THRESHOLD: parseInt(process.env.VAD_THRESHOLD || "3000", 10),
  VAD_SUSTAIN_MS: parseInt(process.env.VAD_SUSTAIN_MS || "150", 10),
  VAD_COOLDOWN_MS: parseInt(process.env.VAD_COOLDOWN_MS || "400", 10),
  VAD_THRESHOLD_STRONG: parseInt(
    process.env.VAD_THRESHOLD_STRONG || "7000",
    10
  ),
  COUNTDOWN_PATH: path.resolve(process.cwd(), "assets/contagem.ogg"),
};