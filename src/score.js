// Scoring: distance points, combo multiplier, near misses, persistent high score.
const KEY = 'ashenrun.best';
export const TIERS = [ // [combo needed, multiplier]
  [0, 1], [5, 2], [15, 3], [30, 5],
];
const DECAY = 4;          // seconds without a clear before the combo drops
const CLEAR_PTS = 10;
const NEAR_PTS = 25;

export function loadBest() {
  try { return Math.max(0, parseInt(localStorage.getItem(KEY), 10) || 0); } catch { return 0; }
}
function saveBest(v) { try { localStorage.setItem(KEY, String(v)); } catch { /* private mode */ } }

export class Score {
  constructor() { this.best = loadBest(); this.reset(); }
  reset() {
    this.points = 0; this.combo = 0; this.sinceClear = 0; this.mult = 1;
    this.events = []; // {type:'clear'|'near'|'tier'|'drop', ...} for the HUD
  }
  tierFor(c) { let m = 1; for (const [need, mul] of TIERS) if (c >= need) m = mul; return m; }
  update(dt, meters) {
    this.points += meters * this.mult;
    this.sinceClear += dt;
    if (this.combo > 0 && this.sinceClear > DECAY) {
      this.combo = 0; this.mult = 1; this.events.push({ type: 'drop' });
    }
  }
  bump(type) {
    this.combo++; this.sinceClear = 0;
    const m = this.tierFor(this.combo);
    if (m > this.mult) this.events.push({ type: 'tier', mult: m });
    this.mult = m;
    const pts = (type === 'near' ? NEAR_PTS : CLEAR_PTS) * this.mult;
    this.points += pts;
    this.events.push({ type, pts });
  }
  get value() { return Math.floor(this.points); }
  finish() {
    const v = this.value, isRecord = v > this.best;
    if (isRecord) { this.best = v; saveBest(v); }
    return isRecord;
  }
  drain() { const e = this.events; this.events = []; return e; }
}
