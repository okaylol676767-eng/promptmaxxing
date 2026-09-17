/* ============================================================
   POST APOCALYPTIC INDIA — v0.3 "LAST STAND"
   Stationary wave shooter. 4 levels, 4 ruined Indian nights.
   Player is fixed; gun is everything. Ammo is finite.
   Levels: 1 Slum Street · 2 Village Rd · 3 Old Market · 4 Ghats
   ============================================================ */
(() => {
'use strict';

/* ---------------- helpers ---------------- */
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (arr) => arr[randi(0, arr.length - 1)];
const TAU = Math.PI * 2;

/* ---------------- canvas ---------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let VW = 0, VH = 0;
function resize() { VW = canvas.width = window.innerWidth; VH = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

/* ---------------- palette ---------------- */
const GUN = { name: 'AK-47', rpm: 600, dmg: 55, dmgHead: 250, spread: 0.035, reload: 2.0 };
/* stamina: per-shot cost grows while auto-firing; winded at 0 (no firing until 30) */
const STAM = { max: 100, shotBase: 2.2, heatStep: 1.35, heatMax: 3.2, regen: 14, regenDelay: 0.7, windedFloor: 30 };
const COL = {
  bg: '#060709', text: '#c4b5fd', neon: '#8b5cf6', dim: '#6d6a85',
  blood: '#7a0e14', bloodDark: '#45080b', gore: '#5c0a10',
  fire: '#f97316', fireCore: '#fdba74', moon: '#a78bfa'
};

/* ============================================================
   LEVEL BACKDROPS — procedural paintings from the 4 photos
   ============================================================ */
function makeLayer(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function px(c) { return c.getContext('2d'); }
// seeded rng for consistent buildings per level
function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function drawSky(g, W, H, hue) {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#05060a'); gr.addColorStop(0.55, '#0c1018'); gr.addColorStop(1, '#0a0c12');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // churning monsoon clouds
  const r = mulberry(7);
  for (let i = 0; i < 90; i++) {
    const x = r() * W, y = r() * H * 0.45, rw = 60 + r() * 180, rh = 12 + r() * 30;
    g.fillStyle = `rgba(16,18,28,${0.25 + r() * 0.4})`;
    g.beginPath(); g.ellipse(x, y, rw, rh, 0, 0, TAU); g.fill();
  }
  // faint moon glow
  const mg = g.createRadialGradient(W * 0.78, H * 0.12, 0, W * 0.78, H * 0.12, 180);
  mg.addColorStop(0, 'rgba(167,139,250,0.12)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mg; g.fillRect(W * 0.78 - 200, H * 0.12 - 200, 400, 400);
}

function drawBuildingBlock(g, x, y, w, h, tone, r, windowsLit) {
  g.fillStyle = tone; g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.strokeRect(x + 0.5, y + 0.5, w, h);
  // exposed rebar / broken silhouette
  if (r() < 0.5) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x + w * (0.1 + r() * 0.5), y, w * 0.18, h * 0.12); }
  for (let wy = y + 10; wy < y + h - 14; wy += 22) {
    for (let wx = x + 8; wx < x + w - 14; wx += 18) {
      const v = r();
      if (v < 0.55) g.fillStyle = 'rgba(5,6,10,0.9)';           // dark socket
      else if (v < 0.8) g.fillStyle = 'rgba(30,34,48,0.8)';     // boarded
      else g.fillStyle = 'rgba(120,90,30,0.55)';                // dying bulb
      g.fillRect(wx, wy, 9, 12);
      if (v >= 0.8 && windowsLit) { const wg = g.createRadialGradient(wx + 4, wy + 6, 0, wx + 4, wy + 6, 26); wg.addColorStop(0, 'rgba(250,190,80,0.16)'); wg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = wg; g.fillRect(wx - 26, wy - 26, 52, 52); }
    }
  }
}

function drawStreetlamp(g, x, y, H) {
  g.strokeStyle = '#0c0d13'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 14, y - 40, x + 34, y - 58); g.stroke(); g.lineWidth = 1;
  g.fillStyle = '#0c0d13'; g.fillRect(x + 30, y - 62, 12, 6);
  const lg = g.createRadialGradient(x + 36, y - 56, 0, x + 36, y - 56, 130);
  lg.addColorStop(0, 'rgba(250,190,80,0.5)'); lg.addColorStop(0.2, 'rgba(250,190,80,0.16)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = lg; g.beginPath(); g.arc(x + 36, y - 56, 130, 0, TAU); g.fill();
  g.fillStyle = '#fde68a'; g.fillRect(x + 33, y - 60, 6, 5);
  // light pool on ground
  const pg = g.createRadialGradient(x + 40, H - 10, 0, x + 40, H - 10, 110);
  pg.addColorStop(0, 'rgba(250,190,80,0.10)'); pg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = pg; g.beginPath(); g.ellipse(x + 40, H - 10, 110, 34, 0, 0, TAU); g.fill();
}

function drawFire(g, x, y) {
  const lg = g.createRadialGradient(x, y, 0, x, y, 120);
  lg.addColorStop(0, 'rgba(249,115,22,0.4)'); lg.addColorStop(0.4, 'rgba(220,60,20,0.14)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = lg; g.beginPath(); g.arc(x, y, 120, 0, TAU); g.fill();
  g.fillStyle = '#1a1210';
  g.beginPath(); g.ellipse(x, y + 6, 34, 10, 0, 0, TAU); g.fill();
  for (const [fx, fh] of [[-10, 26], [0, 38], [12, 24]]) {
    g.fillStyle = fh > 30 ? '#fdba74' : '#f97316';
    g.beginPath(); g.moveTo(x + fx - 7, y + 4); g.quadraticCurveTo(x + fx, y + 4 - fh - Math.sin(x) * 4, x + fx + 7, y + 4); g.closePath(); g.fill();
  }
}

function groundBase(g, W, H, colA, colB) {
  const gr = g.createLinearGradient(0, H * 0.62, 0, H);
  gr.addColorStop(0, colA); gr.addColorStop(1, colB);
  g.fillStyle = gr; g.fillRect(0, H * 0.62, W, H * 0.38);
  const r = mulberry(21);
  g.strokeStyle = 'rgba(0,0,0,0.3)';
  for (let i = 0; i < 70; i++) { // cracks + puddles
    let x = r() * W, y = H * (0.64 + r() * 0.34);
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 3; s++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 30; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const x = r() * W, y = H * (0.7 + r() * 0.26);
    g.fillStyle = 'rgba(120,150,200,0.05)';
    g.beginPath(); g.ellipse(x, y, 30 + r() * 50, 8 + r() * 10, 0, 0, TAU); g.fill();
  }
}

/* ---- LEVEL 1: SLUM STREET — apartment towers, auto-rickshaws, ruined blocks ---- */
function buildLevel1() {
  const W = 1280, H = 720, c = makeLayer(W, H), g = px(c), r = mulberry(101);
  drawSky(g, W, H, '1a2030');
  // far skyline towers
  for (const [x, w, h] of [[40, 90, 260], [150, 70, 330], [250, 100, 290], [380, 80, 240]]) {
    g.fillStyle = '#0d1019'; g.fillRect(x, H * 0.62 - h, w, h);
    for (let wy = H * 0.62 - h + 12; wy < H * 0.62 - 10; wy += 18) for (let wx = x + 8; wx < x + w - 10; wx += 14) {
      g.fillStyle = r() < 0.85 ? 'rgba(6,8,12,0.9)' : 'rgba(110,85,35,0.35)'; g.fillRect(wx, wy, 7, 9);
    }
  }
  // mid buildings
  drawBuildingBlock(g, 520, H * 0.30, 200, H * 0.32, '#141824', r, true);
  drawBuildingBlock(g, 760, H * 0.38, 240, H * 0.24, '#10141d', r, false);
  drawBuildingBlock(g, 1040, H * 0.26, 220, H * 0.36, '#161a26', r, true);
  groundBase(g, W, H, '#181a20', '#0c0d12');
  // debris, barrels, wrecked car
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${20 + r() * 20},${20 + r() * 18},${24 + r() * 20},1)`; g.fillRect(r() * W, H * (0.66 + r() * 0.3), 10 + r() * 26, 6 + r() * 12); }
  g.fillStyle = '#15161c'; g.beginPath(); g.ellipse(180, H - 60, 66, 22, 0, 0, TAU); g.fill();
  g.fillStyle = '#0d0e12'; g.beginPath(); g.arc(150, H - 48, 14, 0, TAU); g.arc(212, H - 48, 14, 0, TAU); g.fill();
  drawStreetlamp(g, 900, H * 0.62, H);
  return c;
}
/* ---- LEVEL 2: VILLAGE ROAD — bent lamp, huts, sugarcane, figures ---- */
function buildLevel2() {
  const W = 1280, H = 720, c = makeLayer(W, H), g = px(c), r = mulberry(202);
  drawSky(g, W, H, '0e1a14');
  // ruined hut row
  for (const [x, w, h] of [[820, 150, 110], [990, 170, 130], [1170, 120, 100]]) {
    g.fillStyle = '#131a16'; g.fillRect(x, H * 0.55 - h, w, h);
    g.beginPath(); g.moveTo(x - 8, H * 0.55 - h); g.lineTo(x + w / 2, H * 0.55 - h - 34); g.lineTo(x + w + 8, H * 0.55 - h); g.closePath();
    g.fillStyle = '#0e1310'; g.fill();
    g.fillStyle = 'rgba(5,7,9,0.9)'; g.fillRect(x + w / 2 - 12, H * 0.55 - 34, 24, 34);
  }
  // sugarcane / palm silhouettes
  for (let i = 0; i < 130; i++) {
    const x = r() * W, base = H * (0.58 + r() * 0.06), h = 30 + r() * 90;
    g.strokeStyle = `rgba(${8 + r() * 10},${24 + r() * 18},${12 + r() * 10},0.9)`; g.lineWidth = 2 + r() * 2;
    g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + (r() - 0.5) * 30, base - h * 0.6, x + (r() - 0.5) * 50, base - h); g.stroke();
  }
  g.lineWidth = 1;
  // brick ruin chunk left
  g.fillStyle = '#191410'; g.fillRect(60, H * 0.47, 200, 110);
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(90, H * 0.47 + 20, 50, 60);
  groundBase(g, W, H, '#151a15', '#0a0d0a');
  // three distant figures
  for (const [fx, s] of [[600, 1], [640, 1.1], [676, 0.95]]) {
    g.fillStyle = '#0a0c0a'; g.beginPath(); g.ellipse(fx, H * 0.60, 7 * s, 20 * s, 0, 0, TAU); g.fill();
    g.beginPath(); g.arc(fx, H * 0.60 - 24 * s, 5 * s, 0, TAU); g.fill();
  }
  // bent streetlamp
  g.strokeStyle = '#0c0d13'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(240, H * 0.60); g.quadraticCurveTo(250, H * 0.30, 300, H * 0.26); g.stroke(); g.lineWidth = 1;
  const lg = g.createRadialGradient(306, H * 0.26 + 8, 0, 306, H * 0.26 + 8, 150);
  lg.addColorStop(0, 'rgba(250,190,80,0.55)'); lg.addColorStop(0.25, 'rgba(250,190,80,0.15)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = lg; g.beginPath(); g.arc(306, H * 0.26 + 8, 150, 0, TAU); g.fill();
  g.fillStyle = '#fde68a'; g.fillRect(302, H * 0.26 + 4, 7, 6);
  return c;
}
/* ---- LEVEL 3: OLD MARKET — shutters, arch, carts, wires ---- */
function buildLevel3() {
  const W = 1280, H = 720, c = makeLayer(W, H), g = px(c), r = mulberry(303);
  drawSky(g, W, H, '171321');
  // building wall with shops
  drawBuildingBlock(g, 0, H * 0.12, 460, H * 0.5, '#191420', r, false);
  drawBuildingBlock(g, 460, H * 0.2, 300, H * 0.42, '#131019', r, true);
  drawBuildingBlock(g, 760, H * 0.1, 520, H * 0.52, '#1a1522', r, true);
  // the arch + grille shutter
  g.fillStyle = '#0e0c13'; g.fillRect(210, H * 0.34, 130, H * 0.28);
  g.strokeStyle = 'rgba(167,139,250,0.25)'; g.lineWidth = 3;
  g.beginPath(); g.arc(275, H * 0.42, 58, Math.PI, 0); g.stroke(); g.lineWidth = 1;
  for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#12131a' : '#0e0f15'; g.fillRect(214, H * 0.44 + i * 14, 122, 12); }
  // wooden carts
  for (const [cx, cy] of [[120, H - 80], [560, H - 60], [980, H - 90]]) {
    g.fillStyle = '#171310'; g.fillRect(cx - 46, cy - 26, 92, 22);
    g.fillStyle = '#0d0b09'; g.beginPath(); g.arc(cx - 26, cy + 2, 11, 0, TAU); g.arc(cx + 26, cy + 2, 11, 0, TAU); g.fill();
    g.strokeStyle = '#100e0b'; g.beginPath(); g.moveTo(cx - 40, cy - 26); g.lineTo(cx + 40, cy - 52); g.stroke();
  }
  // tangled wires
  g.strokeStyle = 'rgba(8,8,12,0.9)';
  for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(0, H * (0.1 + i * 0.03)); g.quadraticCurveTo(W / 2, H * (0.2 + i * 0.035), W, H * (0.08 + i * 0.028)); g.stroke(); }
  groundBase(g, W, H, '#1a1712', '#0d0b08');
  // wet cobblestone shine
  for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(180,170,150,${0.02 + r() * 0.03})`; g.fillRect(r() * W, H * (0.66 + r() * 0.3), 12, 5); }
  drawStreetlamp(g, 330, H * 0.62, H);
  drawFire(g, 1120, H - 46);
  return c;
}
/* ---- LEVEL 4: GHATS — temple steps, spires, river, boats, pyre ---- */
function buildLevel4() {
  const W = 1280, H = 720, c = makeLayer(W, H), g = px(c), r = mulberry(404);
  drawSky(g, W, H, '121021');
  // temple silhouettes
  for (const [x, w, h, spire] of [[60, 180, 200, 1], [290, 120, 140, 0], [950, 160, 180, 1], [1140, 130, 130, 0]]) {
    g.fillStyle = '#14121d'; g.fillRect(x, H * 0.5 - h, w, h);
    if (spire) { g.beginPath(); g.moveTo(x + w * 0.2, H * 0.5 - h); g.lineTo(x + w / 2, H * 0.5 - h - 90); g.lineTo(x + w * 0.8, H * 0.5 - h); g.closePath(); g.fill(); }
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(6,6,10,0.9)'; g.beginPath(); g.arc(x + w * (0.2 + i * 0.15), H * 0.5 - h * 0.6, 8, 0, TAU); g.fill(); }
  }
  // stone steps down to river
  for (let i = 0; i < 12; i++) {
    g.fillStyle = i % 2 ? '#181622' : '#13111b';
    g.fillRect(0, H * 0.5 + i * 13, W, 13);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, H * 0.5 + i * 13 + 11, W, 2);
  }
  // river
  const rg = g.createLinearGradient(0, H * 0.68, 0, H);
  rg.addColorStop(0, '#0d1420'); rg.addColorStop(1, '#070b12');
  g.fillStyle = rg; g.fillRect(0, H * 0.68, W, H * 0.32);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(140,150,200,${0.03 + r() * 0.05})`; g.fillRect(r() * W, H * (0.7 + r() * 0.28), 20 + r() * 60, 2); }
  // boats
  for (const [bx, by, bl] of [[180, H - 60, 90], [420, H - 40, 70], [1020, H - 70, 100], [880, H - 34, 60]]) {
    g.fillStyle = '#0d0b09'; g.beginPath(); g.ellipse(bx, by, bl / 2, 9, 0, 0, Math.PI, true); g.fill();
    g.strokeStyle = '#0d0b09'; g.beginPath(); g.moveTo(bx - bl / 2, by); g.lineTo(bx + bl / 2, by); g.stroke();
  }
  groundBase(g, W, H, '#16141d', '#0b0a10');
  drawFire(g, 640, H - 60); // the pyre
  return c;
}

const LEVELS = [
  { name: 'LEVEL 1 — SLUM STREET',  sub: 'the towers remember rent day',      bg: buildLevel1(), wave: 10, ammo: 24, speed: 0.55, hpMul: 1.0,   fog: 0.50 },
  { name: 'LEVEL 2 — VILLAGE ROAD', sub: 'they walk the cane at night',        bg: buildLevel2(), wave: 16, ammo: 24, speed: 0.62, hpMul: 1.15,  fog: 0.55 },
  { name: 'LEVEL 3 — OLD MARKET',   sub: 'the arch echoes every groan',        bg: buildLevel3(), wave: 24, ammo: 34, speed: 0.68, hpMul: 1.2,   fog: 0.60 },
  { name: 'LEVEL 4 — THE GHATS',    sub: 'the river takes everything, twice',  bg: buildLevel4(), wave: 30, ammo: 46, speed: 0.74, hpMul: 1.25,  fog: 0.65 }
];

/* ============================================================
   GAME STATE
   ============================================================ */
const HORIZON = () => VH * 0.62;             // spawn line
const GROUND_Y = () => VH - 120;             // kill line (reach player)
const LANES = [0.12, 0.3, 0.5, 0.7, 0.88];   // approach lanes (x fraction)

const game = {
  level: 0, state: 'title',          // title | levelstart | playing | levelclear | gameover | won
  ammo: 0, magSize: 30, cylinder: 30, reloading: 0,
  stam: STAM.max, stamHeat: 0, stamRegenT: 0, winded: false,
  kills: 0, totalKills: 0, waveTotal: 0, spawnT: 0, spawnSide: 0,
  recoil: 0, muzzle: 0, shake: 0, hitFlash: 0, redPulse: 0, t: 0,
  breath: 0, hurtT: 0, banner: 0
};
let zombies = [], corpses = [], particles = [], bloodStains = [], floaters = [];
const cursor = { x: 0, y: 0 };
const playerHP = { v: 100 };

/* ============================================================
   ZOMBIES — per reference model: gaunt, shirtless, dark trousers,
   hunched, arms low & wide, pale waxy skin, dark eye sockets
   ============================================================ */
function spawnZombie() {
  const L = LEVELS[game.level];
  const lane = LANES[randi(0, LANES.length - 1)];
  const kindRoll = Math.random();
  const z = {
    x: lane * VW + rand(-60, 60), y: HORIZON() + rand(-20, 30),
    scale: 0.28 + Math.random() * 0.1,           // grows as it approaches
    speed: 26 + game.level * 5 + rand(0, 14),    // px/s at scale 1
    hp: Math.round(100 * L.hpMul * (kindRoll < 0.12 ? 2.2 : 1)),
    kind: kindRoll < 0.12 ? 'brute' : kindRoll < 0.45 ? 'runner' : 'walker',
    phase: rand(0, TAU), lunge: 0, hitT: 0, dead: false,
    lean: rand(-0.12, 0.12), sway: rand(0.8, 1.2)
  };
  if (z.kind === 'runner') { z.speed *= 1.8; z.hp = Math.round(z.hp * 0.7); }
  if (z.kind === 'brute') { z.speed *= 0.7; z.scale += 0.08; }
  z.maxHp = z.hp;
  game.spawned = (game.spawned || 0) + 1;
  zombies.push(z);
}
function damageZombie(z, dmg, hx, hy, headshot) {
  z.hp -= dmg; z.hitT = 0.18;
  goreParticles(hx, hy, headshot ? 20 : 10, headshot);
  if (z.hp <= 0 && !z.dead) {
    z.dead = true; game.kills++; game.totalKills++;
    goreParticles(z.x, z.y, 26, headshot);
    bloodStains.push({ x: z.x, y: z.y, r: rand(24, 44) * z.scale + 14, a: 0.8 });
    corpses.push({ x: z.x, y: z.y, scale: z.scale, ang: rand(-0.5, 0.5), t: 0, fell: 0 });
    floatText(z.x, z.y - 60 * z.scale, headshot ? 'HEADSHOT' : 'KILL', headshot ? '#f87171' : '#c4b5fd');
    sfx.gore();
  }
}
function goreParticles(x, y, n, head) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(30, head ? 320 : 200);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: rand(0.3, 0.8), max: 0.8, col: Math.random() < 0.6 ? COL.blood : (head && Math.random() < 0.4 ? '#d8c8b8' : COL.gore), size: rand(2, 5), drag: 0.9, blood: true });
  }
}
function updateZombies(dt) {
  const ky = GROUND_Y();
  for (const z of zombies) {
    if (z.dead) continue;
    z.phase += dt * (z.kind === 'runner' ? 7 : 4) * z.sway;
    z.hitT = Math.max(0, z.hitT - dt);
    z.scale += z.speed * dt / 900;             // approach = grow
    z.y += z.speed * dt * (0.5 + z.scale);     // nearer = faster visually
    if (z.y >= ky) {
      // reaches the player: bite and die (lunge)
      playerHP.v -= z.kind === 'brute' ? 34 : 18;
      game.redPulse = 1; game.shake = 10; sfx.hurt();
      goreParticles(z.x, ky, 16, false);
      z.dead = true;
      if (playerHP.v <= 0) { playerHP.v = 0; gameOver(); return; }
    }
  }
  zombies = zombies.filter(z => !z.dead);
  corpses.forEach(c => c.t += dt);
  corpses = corpses.filter(c => c.t < 30);
}

/* ============================================================
   GUN — revolver, FPS viewmodel: recoil kick, cylinder reload
   ============================================================ */
function shoot() {
  if (game.state !== 'playing') return;
  if (game.reloading > 0) return;
  if (game.winded) return; // gasping — can't hold the rifle steady
  if (game.cylinder <= 0) { sfx.dryfire(); log('mag empty — R to swap', 'bad'); return; }
  // stamina check: a shot needs at least 1 stamina behind it
  if (game.stam < 1) return;
  game.cylinder--; game.recoil = 1; game.muzzle = 1; game.shake = 6;
  game.shotsFired = (game.shotsFired || 0) + 1;
  // stamina: cost escalates the longer you hold the trigger
  game.stamHeat = Math.min(STAM.heatMax, game.stamHeat + STAM.heatStep);
  game.stam = Math.max(0, game.stam - STAM.shotBase * game.stamHeat);
  game.stamRegenT = STAM.regenDelay;
  if (game.stam <= 0 && !game.winded) {
    game.winded = true;
    log('lungs burning — rifle sagging. let go and breathe.', 'bad');
  }
  sfx.shot();
  window.dispatchEvent(new Event('gun3d-kick')); // 3D viewmodel recoil
  // AK spread: aim point wanders at range (first shot accurate)
  const spreadScale = (game.shotsFired % 30 === 1) ? 0 : 1 + (game.shotsFired % 30) * 0.12;
  const sx = cursor.x + rand(-1, 1) * 26 * spreadScale;
  const sy = cursor.y + rand(-1, 1) * 26 * spreadScale;
  // hit test: nearest zombie whose body contains the spread aim point
  let hit = null, bestDepth = -1;
  for (const z of zombies) {
    if (z.dead) continue;
    const bw = 46 * z.scale * 2.1, bh = 150 * z.scale * 1.7;
    const zx = z.x, zy = z.y - bh * 0.55;
    if (Math.abs(sx - zx) < bw / 2 && sy > zy - bh * 0.5 && sy < zy + bh * 0.62) {
      if (z.scale > bestDepth) { bestDepth = z.scale; hit = z; }
    }
  }
  if (hit) {
    const headTop = hit.y - 150 * hit.scale * 1.7 * 0.95, headBot = headTop + 34 * hit.scale * 1.9;
    const headshot = sy < headBot;
    damageZombie(hit, headshot ? GUN.dmgHead : GUN.dmg + randi(-6, 12), sx, sy, headshot);
  } else {
    // miss: spark on ground/wall
    for (let i = 0; i < 5; i++) particles.push({ x: sx + rand(-8, 8), y: sy + rand(-8, 8), vx: rand(-60, 60), vy: rand(-80, 10), life: 0.2, max: 0.2, col: '#fcd34d', size: 2, drag: 0.9 });
  }
  if (game.cylinder === 0) log('mag dry — R to swap mags', 'bad');
}
function reload() {
  if (game.state !== 'playing' || game.reloading > 0) return;
  const need = game.magSize - game.cylinder;
  if (need === 0 || game.ammo <= 0) { if (game.ammo <= 0) log('all 90 spent. nothing left to feed it.', 'bad'); return; }
  game.reloading = GUN.reload; sfx.reload();
  window.dispatchEvent(new Event('gun3d-reload')); // 3D viewmodel reload dip
}
function finishReload() {
  game.reloading = 0;
  const need = game.magSize - game.cylinder, take = Math.min(need, game.ammo);
  game.cylinder += take; game.ammo -= take; game.shotsFired = 0; // fresh mag, tight spread
  log('mag swapped. ' + (game.cylinder + game.ammo) + ' rounds left of 90.', 'good');
}

/* ============================================================
   AUDIO
   ============================================================ */
let AC = null, master = null, muted = false;
function audioInit() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.4; master.connect(AC.destination);
    const len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
    const g = AC.createGain(); g.gain.value = 0.05;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  } catch (e) { AC = null; }
}
function tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, pan = 0) {
  if (!AC || muted) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(24, freq + slide), AC.currentTime + dur);
  g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  const p = AC.createStereoPanner ? AC.createStereoPanner() : null;
  o.connect(g); if (p) { p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(master); } else g.connect(master);
  o.start(); o.stop(AC.currentTime + dur);
}
function burst(dur = 0.15, vol = 0.25, freq = 800) {
  if (!AC || muted) return;
  const len = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = AC.createBufferSource(); s.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const g = AC.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start();
}
const sfx = {
  shot: () => { burst(0.09, 0.6, 2100); tone(150, 0.16, 'square', 0.3, -95); setTimeout(() => burst(0.5, 0.15, 450), 80); },
  dryfire: () => burst(0.05, 0.12, 2000),
  reload: () => { burst(0.06, 0.16, 1500); setTimeout(() => burst(0.06, 0.16, 1100), 600); setTimeout(() => burst(0.09, 0.2, 850), 1400); },
  groan: (pan) => tone(rand(58, 100), 0.9, 'sawtooth', 0.09, -26, pan),
  gore: () => { burst(0.3, 0.32, 240); tone(52, 0.3, 'sine', 0.2, -20); },
  hurt: () => { tone(120, 0.25, 'sawtooth', 0.28, -55); burst(0.12, 0.24, 280); },
  heart: () => { tone(50, 0.1, 'sine', 0.4); setTimeout(() => tone(46, 0.1, 'sine', 0.3), 120); },
  clear: () => { tone(330, 0.3, 'triangle', 0.16); setTimeout(() => tone(440, 0.35, 'triangle', 0.16), 220); setTimeout(() => tone(587, 0.5, 'triangle', 0.16), 440); },
  lose: () => tone(95, 1.4, 'sawtooth', 0.26, -50),
  win: () => { [262, 330, 392, 523].forEach((f, i) => setTimeout(() => tone(f, 0.5, 'triangle', 0.16), i * 260)); }
};

/* ============================================================
   LOG / FLOATERS
   ============================================================ */
const logEl = document.getElementById('log');
function log(text, cls = '') {
  const div = document.createElement('div');
  div.className = 'logline ' + cls; div.textContent = '> ' + text;
  logEl.appendChild(div);
  while (logEl.children.length > 5) logEl.removeChild(logEl.firstChild);
  setTimeout(() => { div.style.opacity = '0'; }, 7000);
}
function floatText(x, y, text, col) { floaters.push({ x, y, text, col, t: 1 }); }

/* ============================================================
   LEVEL FLOW
   ============================================================ */
function startLevel(i) {
  game.level = i;
  const L = LEVELS[i];
  const leftover = i > 0 ? game.cylinder + game.ammo : 0; // precision carries forward
  const total = Math.min(90, L.ammo * 2 + leftover);      // hard cap: 30 mag + 60 spare
  game.cylinder = Math.min(game.magSize, total);
  game.ammo = total - game.cylinder;
  game.shotsFired = 0;
  game.stam = STAM.max; game.stamHeat = 0; game.stamRegenT = 0; game.winded = false; game.stamWarn = false;
  game.kills = 0; game.waveTotal = L.wave; game.spawned = 0; game.spawnT = 1.2; game.spawnSide = 0;
  zombies = []; corpses = []; particles = []; bloodStains = []; floaters = [];
  playerHP.v = 100;
  game.state = 'playing'; game.banner = 3.4;
  document.getElementById('overlay-levelclear').classList.add('hidden');
  document.getElementById('overlay-gameover').classList.add('hidden');
  document.getElementById('overlay-title').classList.add('hidden');
  log(`${L.name} — ${L.wave} of them. ${game.cylinder + game.ammo}/90 rounds.`, 'obj');
}
function levelClear() {
  game.state = 'levelclear'; sfx.clear();
  if (game.level >= LEVELS.length - 1) { win(); return; }
  document.getElementById('lc-title').textContent = LEVELS[game.level].name + ' — CLEARED';
  document.getElementById('lc-stats').textContent = `KILLS ${game.kills}/${game.waveTotal} · ROUNDS LEFT ${game.cylinder + game.ammo}/90 · HP ${Math.round(playerHP.v)}`;
  document.getElementById('lc-next').textContent = 'GO TO ' + LEVELS[game.level + 1].name + ' →';
  setTimeout(() => document.getElementById('overlay-levelclear').classList.remove('hidden'), 900);
}
function win() {
  game.state = 'won'; sfx.win();
  document.getElementById('win-stats').textContent = `ALL 4 LEVELS · ${game.totalKills} KILLS TOTAL`;
  document.getElementById('overlay-win').classList.remove('hidden');
}
function gameOver() {
  if (game.state !== 'playing') return;
  game.state = 'gameover'; sfx.lose();
  document.getElementById('go-cause').textContent = `they reached you on ${LEVELS[game.level].name.toLowerCase()}. kills: ${game.kills}/${game.waveTotal}. total: ${game.totalKills}.`;
  setTimeout(() => document.getElementById('overlay-gameover').classList.remove('hidden'), 700);
}

/* ============================================================
   UPDATE
   ============================================================ */
function update(dt) {
  game.t += dt;
  game.recoil = Math.max(0, game.recoil - dt * 5);
  game.muzzle = Math.max(0, game.muzzle - dt * 14);
  game.shake = Math.max(0, game.shake - dt * 30);
  game.redPulse = Math.max(0, game.redPulse - dt * 1.3);
  game.banner = Math.max(0, game.banner - dt);
  if (game.reloading > 0) { game.reloading -= dt; if (game.reloading <= 0) finishReload(); }
  if (game.state !== 'playing') return;

  // wave spawning (biters count as dealt with — kills + reached = progress)
  const dealt = game.kills + (game.spawned - zombies.length - game.kills);
  if (game.spawned < game.waveTotal) {
    game.spawnT -= dt;
    if (game.spawnT <= 0) {
      const pressure = 1 + (game.spawned / game.waveTotal) * 1.6; // faster near wave end
      game.spawnT = rand(1.4, 2.6) / pressure;
      spawnZombie();
      if (Math.random() < 0.5) sfx.groan(rand(-0.8, 0.8));
    }
  } else if (zombies.length === 0) levelClear();

  updateZombies(dt);

  // particles
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt;
    p.vx *= p.drag; p.life -= dt;
    if (p.blood && p.life <= 0 && Math.random() < 0.2) bloodStains.push({ x: p.x, y: Math.min(p.y, GROUND_Y() + 40), r: rand(3, 8), a: 0.55 });
  }
  particles = particles.filter(p => p.life > 0);
  if (bloodStains.length > 130) bloodStains.splice(0, bloodStains.length - 130);
  for (const f of floaters) { f.t -= dt; f.y -= dt * 30; }
  floaters = floaters.filter(f => f.t > 0);

  // low hp heartbeat + hurt flash decay
  if (playerHP.v < 35) { game.breath -= dt; if (game.breath <= 0) { game.breath = 1.05; sfx.heart(); } }
  game.hitFlash = Math.max(0, game.hitFlash - dt * 2);

  // --- stamina ---
  // heat cools slowly when not shooting this frame
  if (game.stamRegenT > 0) game.stamRegenT -= dt;
  else {
    game.stamHeat = Math.max(0, game.stamHeat - dt * 1.6);
    const regen = STAM.regen * (1 - game.stamHeat * 0.22);
    if (game.stam < STAM.max) game.stam = Math.min(STAM.max, game.stam + regen * dt);
    if (game.winded && game.stam >= STAM.windedFloor) {
      game.winded = false;
      log('breath back. steady hands.', 'good');
    }
  }
  // hard floor: winded persists until recovered; regen runs even while winded
  if (game.winded && game.stam >= STAM.windedFloor) game.winded = false;
  game.stamWarn = game.stam < 30;
}

/* ============================================================
   RENDER
   ============================================================ */
let grainSeed = 0;
function render() {
  grainSeed = (grainSeed + 1) % 1000;
  const L = LEVELS[game.level];
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, VW, VH);
  const shx = game.shake > 0 ? rand(-game.shake, game.shake) * 0.6 : 0;
  const shy = game.shake > 0 ? rand(-game.shake, game.shake) * 0.4 : 0;

  // backdrop cover-fit
  const bg = L.bg, s = Math.max(VW / bg.width, VH / bg.height);
  const dw = bg.width * s, dh = bg.height * s;
  ctx.save();
  ctx.translate(shx, shy);
  ctx.drawImage(bg, (VW - dw) / 2, (VH - dh) / 2, dw, dh);

  // blood stains on ground band
  for (const b of bloodStains) {
    ctx.fillStyle = COL.bloodDark; ctx.globalAlpha = b.a;
    ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r, b.r * 0.32, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // depth-sorted: corpses then zombies then particles
  corpses.sort((a, b) => a.scale - b.scale);
  for (const c of corpses) drawCorpse(c);
  zombies.sort((a, b) => a.scale - b.scale);
  for (const z of zombies) drawZombie(z);

  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.col; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  for (const f of floaters) {
    ctx.globalAlpha = clamp(f.t, 0, 1);
    ctx.fillStyle = f.col; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // level fog (photo-graded depth haze)
  const fg = ctx.createLinearGradient(0, HORIZON() - 80, 0, HORIZON() + 160);
  fg.addColorStop(0, `rgba(8,10,16,${L.fog})`); fg.addColorStop(1, 'rgba(8,10,16,0)');
  ctx.fillStyle = fg; ctx.fillRect(0, 0, VW, VH);

  ctx.restore();

  // rain (screen-space)
  ctx.strokeStyle = 'rgba(140,160,200,0.12)'; ctx.beginPath();
  for (let i = 0; i < 70; i++) {
    const rx = (i * 197 + game.t * 340) % (VW + 200) - 100;
    const ry = (i * 131 + game.t * 640) % (VH + 200) - 100;
    ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 15);
  }
  ctx.stroke();

  drawGunViewmodel();
  renderPost();
  renderCrosshair();
}

/* zombie per reference: gaunt pale torso, dark trousers, low wide arms */
function drawZombie(z) {
  const s = z.scale;
  const bodyH = 150 * s * 1.7;
  const x = z.x, footY = z.y;
  ctx.save();
  ctx.translate(x, footY);
  const sway = Math.sin(z.phase) * 4 * s;
  const bob = Math.abs(Math.cos(z.phase)) * -3 * s;
  const hunch = z.kind === 'brute' ? 0.34 : 0.22;
  ctx.rotate(z.lean * 0.5);

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.ellipse(0, 2, 30 * s * 1.6, 7 * s * 1.6, 0, 0, TAU); ctx.fill();

  // legs — dark trousers
  ctx.strokeStyle = '#191a1e'; ctx.lineWidth = 9 * s * 1.6; ctx.lineCap = 'round';
  const stride = Math.sin(z.phase) * 10 * s;
  ctx.beginPath(); ctx.moveTo(-4 * s, -bodyH * 0.42); ctx.lineTo(-6 * s + stride, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4 * s, -bodyH * 0.42); ctx.lineTo(6 * s - stride, 0); ctx.stroke();

  // torso — pale waxy, gaunt ribs
  const torsoGrad = ctx.createLinearGradient(-12 * s, 0, 12 * s, 0);
  torsoGrad.addColorStop(0, '#4a3f3a'); torsoGrad.addColorStop(0.5, '#5c4e46'); torsoGrad.addColorStop(1, '#3e342f');
  ctx.fillStyle = z.hitT > 0 ? '#8a4a4a' : torsoGrad;
  ctx.save();
  ctx.translate(sway * 0.4, bob);
  ctx.rotate(hunch * (z.kind === 'runner' ? 1.4 : 1));
  // ribcage shading
  ctx.beginPath(); ctx.ellipse(0, -bodyH * 0.66, 13 * s * 1.5, bodyH * 0.24, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(30,22,20,0.5)'; ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(0, -bodyH * 0.6, 10 * s * 1.5 * (i / 4), 0.2, Math.PI - 0.2); ctx.stroke(); }

  // arms — low, wide, reaching (reference pose)
  ctx.strokeStyle = '#54463f'; ctx.lineWidth = 5.5 * s * 1.6;
  const armSwing = Math.sin(z.phase * 0.9) * 5 * s;
  ctx.beginPath(); ctx.moveTo(-8 * s, -bodyH * 0.78); ctx.quadraticCurveTo(-26 * s, -bodyH * 0.52, -30 * s + armSwing, -bodyH * 0.30); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8 * s, -bodyH * 0.78); ctx.quadraticCurveTo(26 * s, -bodyH * 0.52, 30 * s - armSwing, -bodyH * 0.30); ctx.stroke();
  // hands — long fingers
  ctx.lineWidth = 2 * s * 1.6;
  for (const sgn of [-1, 1]) for (let f = 0; f < 3; f++) {
    ctx.beginPath(); ctx.moveTo(sgn * 30 * s - armSwing * sgn * 0 + sgn * 0, -bodyH * 0.30);
    ctx.lineTo(sgn * (34 + f * 3) * s, -bodyH * (0.30 - 0.045 - f * 0.012)); ctx.stroke();
  }

  // head — skull-thin, dark sockets
  const hy = -bodyH * 0.95;
  ctx.fillStyle = z.hitT > 0 ? '#9a5a5a' : '#6a5a50';
  ctx.beginPath(); ctx.ellipse(sway * 0.3, hy, 8.5 * s * 1.5, 11 * s * 1.5, 0.1, 0, TAU); ctx.fill();
  // jaw
  ctx.fillStyle = '#54463f'; ctx.fillRect(-4 * s, hy + 6 * s, 8 * s, 5 * s);
  // eyes: dark sockets with pale glint
  ctx.fillStyle = '#14100e';
  ctx.beginPath(); ctx.arc(-3.2 * s, hy - 2 * s, 2.1 * s, 0, TAU); ctx.arc(3.2 * s, hy - 2 * s, 2.1 * s, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(220,210,200,0.5)';
  ctx.fillRect(-3.8 * s, hy - 2.6 * s, 1.4 * s, 1.4 * s); ctx.fillRect(2.6 * s, hy - 2.6 * s, 1.4 * s, 1.4 * s);
  ctx.restore();
  ctx.restore();
  ctx.lineCap = 'butt'; ctx.lineWidth = 1;
}
function drawCorpse(c) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.ang);
  ctx.fillStyle = '#231318';
  ctx.beginPath(); ctx.ellipse(0, -6 * c.scale, 40 * c.scale * 1.6, 10 * c.scale * 1.6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3e342f';
  ctx.beginPath(); ctx.arc(34 * c.scale, -8 * c.scale, 8 * c.scale * 1.4, 0, TAU); ctx.fill();
  ctx.restore();
}

/* FPS viewmodel — revolver bottom-right, recoil kick + reload dip */
function drawGunViewmodel() {
  if (game.state === 'title') return;
  if (window.__gun3dReady) return; // Spline 3D gun took over
  const reloading = game.reloading > 0;
  const kick = game.recoil;
  const dip = reloading ? Math.sin(clamp(1 - game.reloading / 2.0, 0, 1) * Math.PI) * 90 : 0;
  const bx = VW - 235 - kick * 16, by = VH - 150 + kick * 26 + dip;
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(-0.12 + kick * 0.16 - dip * 0.004);

  // forearm + sleeve
  ctx.fillStyle = '#221e2e';
  ctx.beginPath(); ctx.moveTo(150, 260); ctx.lineTo(210, 260); ctx.lineTo(190, 60); ctx.lineTo(140, 70); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(139,92,246,0.25)'; ctx.stroke();
  // hand
  ctx.fillStyle = '#584a40';
  ctx.beginPath(); ctx.ellipse(140, 70, 34, 26, -0.5, 0, TAU); ctx.fill();
  // barrel + cylinder
  ctx.fillStyle = '#3a3d47';
  ctx.beginPath(); ctx.moveTo(-20, 26); ctx.lineTo(130, 6); ctx.lineTo(132, 22); ctx.lineTo(-18, 46); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2e3138'; ctx.fillRect(30, 18, 34, 30); // cylinder block
  // cylinder chambers — show loaded rounds
  for (let i = 0; i < 6; i++) {
    const loaded = i < game.cylinder;
    ctx.fillStyle = loaded ? '#fbbf24' : '#111';
    const a = (i / 6) * TAU;
    ctx.beginPath(); ctx.arc(47 + Math.cos(a) * 10, 33 + Math.sin(a) * 10, 3, 0, TAU); ctx.fill();
  }
  // hammer + sights
  ctx.fillStyle = '#43464f'; ctx.fillRect(18, 2, 10, 10);
  ctx.fillStyle = '#565a64'; ctx.fillRect(118, 0, 8, 6);

  // muzzle flash
  if (game.muzzle > 0) {
    const m = game.muzzle;
    const fx = -28, fy = 30;
    const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 90 * m + 30);
    fg.addColorStop(0, `rgba(253,186,116,${0.9 * m})`);
    fg.addColorStop(0.4, `rgba(249,115,22,${0.5 * m})`);
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fx, fy, 90 * m + 30, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(253,224,152,${m})`;
    for (let i = 0; i < 5; i++) {
      const a = rand(0, TAU);
      ctx.beginPath(); ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(a) * (26 + rand(0, 30)) * m, fy + Math.sin(a) * (12 + rand(0, 14)) * m);
      ctx.lineTo(fx + Math.cos(a + 0.5) * 10 * m, fy + Math.sin(a + 0.5) * 6 * m);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
  // reload prompt over gun
  if (reloading) {
    ctx.fillStyle = '#fbbf24'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('RELOADING' + '.'.repeat(1 + Math.floor(game.t * 3) % 3), VW - 235, VH - 170);
  }
}

function renderPost() {
  // hp vignette
  const squeeze = clamp((100 - playerHP.v) * 0.5, 0, 60);
  ctx.fillStyle = 'rgba(2,2,6,1)';
  ctx.beginPath(); ctx.rect(0, 0, VW, VH);
  ctx.ellipse(VW / 2, VH / 2, VW / 2 - squeeze, VH / 2 - squeeze * 1.1, 0, 0, TAU);
  ctx.fill('evenodd');
  // film grain
  ctx.globalAlpha = 0.045;
  for (let i = 0; i < 120; i++) {
    const gx = (i * 977 + grainSeed * 137) % VW, gy = (i * 761 + grainSeed * 271) % VH;
    ctx.fillStyle = i % 2 ? '#fff' : '#000'; ctx.fillRect(gx, gy, 2, 2);
  }
  ctx.globalAlpha = 1;
  // red pulse on bite
  if (game.redPulse > 0) { ctx.fillStyle = `rgba(153,27,27,${game.redPulse * 0.3})`; ctx.fillRect(0, 0, VW, VH); }
}
function renderCrosshair() {
  if (game.state !== 'playing') return;
  const x = cursor.x, y = cursor.y;
  const spread = game.reloading > 0 ? 16 : 7 + game.recoil * 10;
  ctx.strokeStyle = game.reloading > 0 ? 'rgba(109,106,133,0.7)' : 'rgba(251,191,36,0.95)';
  ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.stroke();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * spread, y + dy * spread);
    ctx.lineTo(x + dx * (spread + 7), y + dy * (spread + 7));
    ctx.stroke();
  }
}

/* ============================================================
   HUD
   ============================================================ */
const hpFill = document.getElementById('hp-fill');
const stamFill = document.getElementById('stam-fill');
const stamWarn = document.getElementById('stamwarn');
const ammoEl = document.getElementById('ammo');
let lastAmmoSnapshot = '';
const invEl = document.getElementById('inv');
const objectiveEl = document.getElementById('objective');
function updateHUD() {
  hpFill.style.width = clamp(Math.max(0, playerHP.v), 0, 100) + '%';
  hpFill.style.background = playerHP.v < 30 ? '#dc2626' : '#8b5cf6';
  // stamina bar: green → amber → red, red while winded
  stamFill.style.width = clamp(game.stam, 0, 100) + '%';
  stamFill.style.background = game.winded ? '#dc2626' : game.stam < 30 ? '#f87171' : game.stam < 55 ? '#fbbf24' : '#4ade80';
  stamWarn.classList.toggle('hidden', !(game.stam < 30 && game.state === 'playing'));
  // AK mag readout: bars for the 30, count for reserves
  let mag = '';
  for (let i = 0; i < game.magSize; i += 3) mag += i < game.cylinder ? '▮' : '▯';
  ammoEl.innerHTML = `<span style="font-size:13px;letter-spacing:1px">AK-47</span> ${mag} <span style="color:var(--text)">${game.cylinder}</span><span style="color:var(--dim)">/90 · +${game.ammo}</span>` + (game.reloading > 0 ? ' <span class="rl">RELOADING</span>' : '');
  invEl.innerHTML = `<span class="inv-item">KILLS ${game.kills} / ${game.waveTotal}</span><span class="inv-item">R — RELOAD</span>`;
  objectiveEl.textContent = LEVELS[game.level].name;
}

/* ============================================================
   LOOP
   ============================================================ */
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  tick(dt);
  requestAnimationFrame(loop);
}
// full-auto fire: hold LMB, GUN.rpm rounds/min
let mouseDown = false, fireCd = 0;
function autoFire(dt) {
  fireCd -= dt;
  if (!mouseDown || game.state !== 'playing' || game.reloading > 0) return;
  if (game.cylinder === 0) { if (game.ammo > 0) reload(); return; } // auto mag-swap on dry
  if (fireCd <= 0) { fireCd = 60 / GUN.rpm; shoot(); }
}
function tick(dt) {
  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) resize();
  update(dt);
  autoFire(dt);
  if (game.state !== 'title') { render(); updateHUD(); }
}
requestAnimationFrame(loop);
window.__pump = (seconds, step = 0.05) => { for (let t = 0; t < seconds; t += step) tick(step); };
window.__dbg = () => ({ state: game.state, level: game.level, cylinder: game.cylinder, ammo: game.ammo, kills: game.kills, waveTotal: game.waveTotal, alive: zombies.length, hp: Math.round(playerHP.v), reloading: game.reloading, stam: Math.round(game.stam), heat: game.stamHeat.toFixed(2), winded: game.winded });
window.__sethp = (v) => { playerHP.v = v; };
window.__aimFire = () => {
  const z = zombies.filter(q => !q.dead).sort((a, b) => b.y - a.y)[0]; // most dangerous first
  if (!z) return 'no targets';
  const bodyH = 150 * z.scale * 1.7;
  const headY = z.y - bodyH * 0.95, bodyY = z.y - bodyH * 0.6;
  const at = { x: Math.round(z.x), headY: Math.round(headY), bodyY: Math.round(bodyY) };
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: at.x, clientY: at.bodyY }));
  canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: at.x, clientY: at.bodyY }));
  return { firedAt: at, kills: game.kills, zHp: z.hp, cylinder: game.cylinder };
};

/* ============================================================
   INPUT
   ============================================================ */
window.addEventListener('mousemove', (e) => { cursor.x = e.clientX; cursor.y = e.clientY; });
canvas.addEventListener('mousedown', (e) => {
  if (game.state === 'title') { beginRun(); return; }
  if (e.button === 0) { mouseDown = true; shoot(); }
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
window.addEventListener('blur', () => { mouseDown = false; });
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') reload();
  if (e.code === 'KeyM') { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.4; log(muted ? 'muted.' : 'sound on.'); }
});
function beginRun() { if (game.state !== 'title') return; audioInit(); startLevel(0); }
document.getElementById('btn-start').addEventListener('click', beginRun);
document.getElementById('lc-next').addEventListener('click', () => startLevel(game.level + 1));
document.getElementById('lc-retry').addEventListener('click', () => startLevel(game.level));
document.getElementById('go-retry').addEventListener('click', () => startLevel(game.level));
document.getElementById('win-again').addEventListener('click', () => startLevel(0));

/* ============================================================
   BOOT: title shows level 1 backdrop with idle zombies parading
   ============================================================ */
game.state = 'title';
(function titleScene() {
  for (let i = 0; i < 5; i++) { spawnZombie(); zombies.forEach(z => { z.y = HORIZON() + rand(0, 60); }); }
})();
setInterval(() => { if (game.state === 'title') { zombies.forEach(z => { z.phase += 0.05; z.y += 0.05; if (z.y > GROUND_Y()) z.y = HORIZON(); }); } }, 50);
function titleRender() { if (game.state === 'title') { render(); } requestAnimationFrame(titleRender); }
titleRender();

})();
