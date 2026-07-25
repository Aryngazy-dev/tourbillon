let ctx = null;
let enabled = true;

export function setSoundEnabled(value) {
  enabled = !!value;
}

export function isSoundEnabled() {
  return enabled;
}

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  return ctx;
}

function playTone(freq, duration, type, gainPeak) {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(gainPeak || 0.08, c.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

export function playDone() {
  playTone(660, 0.18, 'sine');
  setTimeout(() => playTone(880, 0.16, 'sine'), 60);
}

export function playDrop() {
  playTone(420, 0.09, 'triangle', 0.05);
}

export function playDelete() {
  playTone(220, 0.16, 'sawtooth', 0.05);
}

export function playColumnComplete() {
  playTone(523, 0.15, 'sine');
  setTimeout(() => playTone(659, 0.15, 'sine'), 100);
  setTimeout(() => playTone(784, 0.22, 'sine'), 200);
}
