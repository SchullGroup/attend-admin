/**
 * Check-in tones for the gate, synthesised with the Web Audio API (no audio
 * file to load). Fails silently where audio is unavailable or blocked.
 *
 * - Success: two warm marimba notes rising (C5 → G5) — friendly, and soft
 *   enough for a quiet hall.
 * - Refused / already checked in: two soft falling notes — clearly "no", but
 *   not harsh in a quiet hall.
 */

let ctx: AudioContext | null = null;

// ── On / off (remembered per browser) ──────────────────────────────────────

const SOUND_KEY = "attend.checkinSound";

/** True unless the gate staff turned check-in sounds off on this browser. */
export function isCheckInSoundOn(): boolean {
  if (typeof window === "undefined") return true;
  try { return window.localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; }
}

export function setCheckInSoundOn(on: boolean) {
  try { window.localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch { /* storage blocked — just this session */ }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function master(c: AudioContext): AudioNode {
  // Gentle low-pass keeps the top partials from sounding tinny on laptop speakers.
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 6000;
  lp.connect(c.destination);
  return lp;
}

/**
 * One marimba strike: a sine fundamental plus the bar's characteristic overtones
 * (≈3.93× and ≈9.2×), each dying away quickly — a warm, wooden "tok".
 */
function marimba(c: AudioContext, out: AudioNode, freq: number, start: number, level: number, decay: number) {
  const partials: [ratio: number, gain: number, decay: number][] = [
    [1,    1.0,  decay],
    [3.93, 0.25, decay * 0.35],
    [9.2,  0.06, decay * 0.15],
  ];
  for (const [ratio, g, d] of partials) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * ratio;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level * g, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + d);
    osc.connect(gain).connect(out);
    osc.start(start);
    osc.stop(start + d + 0.03);
  }
}

/** Success: two warm marimba notes rising (C5 → G5). */
export function playCheckInSuccess() {
  if (!isCheckInSoundOn()) return;
  const c = audio();
  if (!c) return;
  const out = master(c);
  const t = c.currentTime + 0.01;
  marimba(c, out, 523.25, t,        0.3, 0.45);
  marimba(c, out, 783.99, t + 0.13, 0.3, 0.6);
}

/** Refused / already checked in: two soft falling notes (E4 → C4). */
export function playCheckInError() {
  if (!isCheckInSoundOn()) return;
  const c = audio();
  if (!c) return;
  const out = master(c);
  const t = c.currentTime + 0.01;
  for (const [freq, at] of [[329.63, 0], [261.63, 0.16]] as const) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t + at);
    gain.gain.exponentialRampToValueAtTime(0.16, t + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.32);
    osc.connect(gain).connect(out);
    osc.start(t + at);
    osc.stop(t + at + 0.36);
  }
}
