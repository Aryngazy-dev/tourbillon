export function fireConfetti(originXRatio) {
  if (typeof window.confetti !== 'function') return;
  window.confetti({
    particleCount: 90,
    spread: 70,
    startVelocity: 32,
    origin: { x: originXRatio == null ? 0.5 : originXRatio, y: 0.3 },
    colors: ['#e8a94b', '#45d9c6', '#8b7cf6', '#f2685c', '#6ea8fe']
  });
}
