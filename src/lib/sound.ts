import { useStore } from '../store';
import type { ScoreTier } from './logic';

/**
 * Web Audio 合成音效（无音频文件，离线可用）。
 * 所有声音短促自终止（≤1.4s）；静音开关存于 store。
 */

type LiveNode = OscillatorNode | AudioBufferSourceNode;
const live = new Set<LiveNode>();
let ctx: AudioContext | null = null;

function on(): boolean {
  return useStore.getState().soundOn;
}

function ac(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** 在用户点击手势中调用，解锁后续自动播放 */
export function unlockAudio(): void {
  if (!on()) return;
  try {
    ac();
  } catch {
    /* 环境不支持则全程静默 */
  }
}

interface ToneOpts {
  freq: number;
  start?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  glideTo?: number;
}

function tone({ freq, start = 0, dur = 0.15, type = 'sine', gain = 0.2, glideTo }: ToneOpts): void {
  const a = ac();
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo && glideTo > 0) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.001), t0 + 0.014);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
  live.add(osc);
  osc.onended = () => live.delete(osc);
}

function noise(start = 0, dur = 0.25, gain = 0.12): void {
  const a = ac();
  const t0 = a.currentTime + start;
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const f = a.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 1400;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t0);
  live.add(src);
  src.onended = () => live.delete(src);
}

/** 停掉正在响的声音（跳过动画时掐掉摇晃咔哒声） */
export function cancelSounds(): void {
  for (const n of live) {
    try {
      n.onended = null;
      n.stop();
    } catch {
      /* 已停止 */
    }
  }
  live.clear();
}

/** 摇晃棘轮咔哒，prog 0→1 音调渐升 */
export function tick(prog: number): void {
  if (!on()) return;
  try {
    tone({ freq: 460 + 540 * prog, dur: 0.035, type: 'square', gain: 0.05 });
  } catch {
    /* ignore */
  }
}

/** 胶囊爆开：气爆 + 短促下滑哨音 */
export function playPop(): void {
  if (!on()) return;
  try {
    noise(0, 0.22, 0.1);
    tone({ freq: 880, dur: 0.09, type: 'square', gain: 0.05, glideTo: 320 });
  } catch {
    /* ignore */
  }
}

/** 揭晓音效：按分数分级 */
export function playReveal(tier: ScoreTier): void {
  if (!on()) return;
  try {
    switch (tier) {
      case 'jackpot': {
        // 满分/欧皇：上行五音琶音 + 大三和弦 + 闪亮噪声
        [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) =>
          tone({ freq: f, start: i * 0.09, dur: 0.22, type: 'triangle', gain: 0.15 }),
        );
        [523.25, 659.25, 783.99].forEach((f) =>
          tone({ freq: f, start: 0.46, dur: 0.75, type: 'sine', gain: 0.09 }),
        );
        tone({ freq: 1567.98, start: 0.46, dur: 0.9, type: 'triangle', gain: 0.07 });
        noise(0.46, 0.5, 0.06);
        break;
      }
      case 'great':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          tone({ freq: f, start: i * 0.09, dur: 0.2, type: 'triangle', gain: 0.13 }),
        );
        break;
      case 'good':
        [587.33, 739.99, 880].forEach((f, i) =>
          tone({ freq: f, start: i * 0.08, dur: 0.18, type: 'triangle', gain: 0.11 }),
        );
        break;
      case 'small':
        tone({ freq: 659.25, dur: 0.12, gain: 0.11 });
        tone({ freq: 880, start: 0.09, dur: 0.14, gain: 0.09 });
        break;
      case 'zero':
        tone({ freq: 233.08, dur: 0.2, gain: 0.1, glideTo: 174.61 });
        break;
      case 'neg-small':
        tone({ freq: 196, dur: 0.18, gain: 0.15, glideTo: 155.56 });
        break;
      case 'neg-mid':
        tone({ freq: 220, dur: 0.2, gain: 0.16, glideTo: 146.83 });
        tone({ freq: 164.81, start: 0.17, dur: 0.26, gain: 0.14, glideTo: 110 });
        break;
      case 'neg-big':
        tone({ freq: 233.08, dur: 0.55, type: 'sawtooth', gain: 0.09, glideTo: 82.41 });
        tone({ freq: 116.54, dur: 0.6, gain: 0.18, glideTo: 65.41 });
        break;
      case 'neg-huge':
        // 心碎低鸣：下滑锯齿 + 低音重击
        tone({ freq: 246.94, dur: 0.85, type: 'sawtooth', gain: 0.09, glideTo: 73.42 });
        tone({ freq: 123.47, dur: 0.95, gain: 0.2, glideTo: 55 });
        tone({ freq: 61.74, start: 0.06, dur: 0.5, gain: 0.22 });
        break;
    }
  } catch {
    /* ignore */
  }
}

/** 收下：轻快双击 */
export function playCollect(): void {
  if (!on()) return;
  try {
    tone({ freq: 739.99, dur: 0.06, type: 'triangle', gain: 0.07 });
    tone({ freq: 987.77, start: 0.06, dur: 0.09, type: 'triangle', gain: 0.06 });
  } catch {
    /* ignore */
  }
}
