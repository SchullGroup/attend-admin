/**
 * Short confirmation tones for the gate: a bright two-note "ding" when someone
 * is checked in, and a low buzz when a check-in is refused. Generated with the
 * Web Audio API, so there's no audio file to load. Fails silently where audio
 * is unavailable or blocked.
 */

let ctx: AudioContext | null = null;

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

function tone(c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = "sine", peak = 0.25) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** Success: two rising notes (E5 → A5). */
export function playCheckInSuccess() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  tone(c, 659.25, t, 0.14);
  tone(c, 880, t + 0.12, 0.22);
}

/** Refused / already checked in: one short low buzz. */
export function playCheckInError() {
  const c = audio();
  if (!c) return;
  tone(c, 196, c.currentTime, 0.28, "square", 0.08);
}
