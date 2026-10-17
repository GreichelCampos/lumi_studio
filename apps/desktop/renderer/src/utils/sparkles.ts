// Safe, lightweight celebration particle effect that runs anywhere without web worker / offscreen canvas bugs

export function triggerSparkles(xRatio = 0.8, yRatio = 0.15) {
  try {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9999';
    container.style.overflow = 'hidden';
    document.body.appendChild(container);

    const colors = ['#22d3ee', '#38bdf8', '#818cf8', '#34d399', '#fef08a'];
    const originX = window.innerWidth * xRatio;
    const originY = window.innerHeight * yRatio;
    const particleCount = 28;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      const size = Math.random() * 6 + 4;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const speed = Math.random() * 80 + 40;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 30; // slightly upward bias

      particle.style.position = 'absolute';
      particle.style.left = `${originX}px`;
      particle.style.top = `${originY}px`;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.backgroundColor = color;
      particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      particle.style.boxShadow = `0 0 6px ${color}`;
      particle.style.transition = 'transform 0.75s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.75s ease-out';
      particle.style.opacity = '1';
      particle.style.transform = 'translate(-50%, -50%) scale(1)';

      container.appendChild(particle);

      const runFrame = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame
        : (fn: () => void) => setTimeout(fn, 16);

      runFrame(() => {
        particle.style.transform = `translate(calc(-50% + ${vx}px), calc(-50% + ${vy}px)) scale(0.2) rotate(${Math.random() * 360}deg)`;
        particle.style.opacity = '0';
      });
    }

    setTimeout(() => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }, 850);
  } catch (err) {
    console.debug('Celebration animation skipped:', err);
  }
}
