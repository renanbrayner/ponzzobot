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

  // Fast path: fala muito forte e curta
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

  // abaixo do piso (use a média para decidir)
  if (avgRms < CFG.VAD_FLOOR) {
    st.startMs = 0;
    st.lastAbove = 0;
    st.framesAbove = 0;
    st.framesTotal = 0;
    return;
  }

  // entre piso e threshold
  if (avgRms >= CFG.VAD_FLOOR && avgRms < CFG.VAD_THRESHOLD) {
    st.framesTotal++;
    st.lastAbove = 0;
    return;
  }

  // acima do threshold
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