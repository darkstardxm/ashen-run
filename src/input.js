// Keyboard + touch input, queued as discrete actions.
export class Input {
  constructor(el) {
    this.queue = [];
    const map = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'slide', KeyS: 'slide',
      Enter: 'confirm', Escape: 'pause', KeyP: 'pause',
    };
    window.addEventListener('keydown', (e) => {
      const a = map[e.code];
      if (!a) return;
      e.preventDefault();
      if (e.repeat) return;
      this.queue.push(a);
    });

    let sx = 0, sy = 0, st = 0, tracking = false;
    const SWIPE = 30;
    window.addEventListener('touchstart', (e) => {
      if (e.target.closest('button')) return;
      const t = e.changedTouches[0];
      sx = t.clientX; sy = t.clientY; st = performance.now(); tracking = true;
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (!tracking) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > SWIPE || Math.abs(dy) > SWIPE) {
        tracking = false;
        if (Math.abs(dx) > Math.abs(dy)) this.queue.push(dx > 0 ? 'right' : 'left');
        else this.queue.push(dy > 0 ? 'slide' : 'jump');
      }
    }, { passive: true });
    window.addEventListener('touchend', () => {
      if (tracking && performance.now() - st < 300) this.queue.push('jump'); // tap = jump
      tracking = false;
    }, { passive: true });
  }
  drain() { const q = this.queue; this.queue = []; return q; }
}
