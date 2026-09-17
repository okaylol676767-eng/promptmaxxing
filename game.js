/* ============================================================
   POST APOCALYPTIC INDIA — v0.2 "WAVES"
   A short, realistic zombie night. Days Gone-inspired:
   sound stealth, the eye, scarce ammo, THE HORDE.
   "Are they gone?" — no. They heard the door.
   ============================================================ */
(() => {
'use strict';

/* ---------------- helpers ---------------- */
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const pick = (arr) => arr[randi(0, arr.length - 1)];
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------- constants ---------------- */
const T = { ROAD: 0, SIDEWALK: 1, BUILDING: 2, WRECK: 3, PUDDLE: 4, BARRICADE: 5, FENCE: 6, INTERIOR: 7, SCOOTER: 8, DEBRIS: 9 };
const SOLID = new Set([T.BUILDING, T.WRECK, T.BARRICADE, T.FENCE, T.SCOOTER, T.DEBRIS]);
const TILE = 48, MAP_W = 44, MAP_H = 30;
const COL = {
  bg: '#060709', road: '#17181c', roadAlt: '#1a1b20', walk: '#202127', walkAlt: '#23242b',
  building: '#0d0e14', bedge: '#1f2130', interior: '#11121a',
  puddle: '#141a22', wreck: '#1b1e26', barricade: '#241d16', fence: '#2a2c38',
  blood: '#7a0e14', bloodDark: '#45080b', gore: '#5c0a10',
  neon: '#8b5cf6', text: '#c4b5fd', dim: '#6d6a85',
  fire: '#f97316', fireCore: '#fdba74'
};

/* ---------------- canvas ---------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let VW = 0, VH = 0;
function resize() {
  VW = canvas.width = window.innerWidth; VH = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

/* ---------------- map: one long street ---------------- */
const map = new Uint8Array(MAP_W * MAP_H);
const at = (tx, ty) => (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) ? T.BUILDING : map[ty * MAP_W + tx];
const setT = (tx, ty, t) => { if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) map[ty * MAP_W + tx] = t; };
const solidPx = (x, y) => SOLID.has(at(Math.floor(x / TILE), Math.floor(y / TILE)));

const playerSpawn = { x: 5 * TILE, y: 15 * TILE };
function buildWorld() {
  // road band rows 10..20, sidewalk rows 8..9 and 21..22, buildings elsewhere
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    setT(x, y, y >= 10 && y <= 20 ? T.ROAD : (y === 8 || y === 9 || y === 21 || y === 22) ? T.SIDEWALK : T.BUILDING);
  }
  setT(5, 9, T.INTERIOR); setT(5, 10, T.INTERIOR); // the open doorway (home)
  // wrecks along the street (two flippable)
  [[12, 15], [12, 16], [26, 12], [26, 13], [34, 17], [34, 18], [19, 12], [19, 13], [38, 12]].forEach(([x, y]) => setT(x, y, T.WRECK));
  // scooter + fuel (wave 3 boom)
  setT(29, 18, T.SCOOTER);
  // debris to break sightlines
  [[9, 18], [16, 19], [22, 11], [31, 14], [36, 11], [41, 18], [14, 11]].forEach(([x, y]) => setT(x, y, T.DEBRIS));
  // side lanes blocked by fences so gameplay stays on the street
  for (let x = 0; x < MAP_W; x++) { setT(x, 0, T.FENCE); setT(x, MAP_H - 1, T.FENCE); }
  for (let y = 0; y < MAP_H; y++) { setT(0, y, T.FENCE); setT(MAP_W - 1, y, T.FENCE); }
  // puddles
  for (let i = 0; i < 46; i++) {
    const tx = randi(1, MAP_W - 2), ty = randi(10, 20);
    if (at(tx, ty) === T.ROAD) setT(tx, ty, T.PUDDLE);
  }
}
buildWorld();

/* pre-render ground */
const groundCanvas = document.createElement('canvas');
groundCanvas.width = MAP_W * TILE; groundCanvas.height = MAP_H * TILE;
(function prerender() {
  const g = groundCanvas.getContext('2d');
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const t = at(tx, ty), x = tx * TILE, y = ty * TILE;
    let base = COL.road;
    if (t === T.ROAD) base = (tx + ty) % 2 ? COL.road : COL.roadAlt;
    else if (t === T.SIDEWALK) base = (tx + ty) % 2 ? COL.walk : COL.walkAlt;
    else if (t === T.BUILDING) base = COL.building;
    else if (t === T.INTERIOR) base = COL.interior;
    else if (t === T.PUDDLE) base = COL.puddle;
    else if (t === T.WRECK) base = COL.wreck;
    else if (t === T.SCOOTER) base = COL.road;
    else if (t === T.DEBRIS) base = COL.road;
    g.fillStyle = base; g.fillRect(x, y, TILE, TILE);
    if (t === T.BUILDING) { // facades with faint windows
      g.fillStyle = 'rgba(120,130,180,0.04)';
      if ((tx * 7 + ty * 3) % 5 < 2) g.fillRect(x + 10, y + 10, 16, 22);
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    }
    if (t === T.SIDEWALK) { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.strokeRect(x + 0.5, y + 0.5, TILE, TILE); }
    if (t === T.WRECK) {
      g.fillStyle = '#151820'; g.fillRect(x + 2, y + 6, TILE - 4, TILE - 12);
      g.fillStyle = '#0e1016'; g.fillRect(x + 6, y + 10, 14, 12); g.fillRect(x + 26, y + 10, 14, 12);
      g.strokeStyle = 'rgba(150,160,190,0.14)'; g.strokeRect(x + 2.5, y + 6.5, TILE - 5, TILE - 13);
    }
    if (t === T.PUDDLE) { g.fillStyle = 'rgba(130,160,210,0.05)'; g.beginPath(); g.ellipse(x + 24, y + 24, 19, 12, 0.3, 0, 7); g.fill(); }
    if (t === T.DEBRIS) { g.fillStyle = '#2c2e36'; for (let r = 0; r < 6; r++) g.fillRect(x + randi(3, 38), y + randi(3, 38), randi(4, 9), randi(3, 7)); }
    if (t === T.SCOOTER) { g.fillStyle = '#3a2416'; g.fillRect(x + 8, y + 14, 30, 16); g.fillStyle = '#181818'; g.beginPath(); g.arc(x + 14, y + 32, 6, 0, 7); g.arc(x + 34, y + 32, 6, 0, 7); g.fill(); }
    // speckle
    g.fillStyle = 'rgba(255,255,255,0.015)';
    for (let s = 0; s < 2; s++) g.fillRect(x + randi(2, 44), y + randi(2, 44), 2, 2);
  }
  // lane crack + road paint
  g.strokeStyle = 'rgba(0,0,0,0.4)';
  for (let i = 0; i < 60; i++) {
    let x = rand(0, groundCanvas.width), y = rand(0, groundCanvas.height);
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 3; s++) { x += rand(-20, 20); y += rand(-20, 20); g.lineTo(x, y); }
    g.stroke();
  }
  g.strokeStyle = 'rgba(200,190,120,0.10)'; g.setLineDash([18, 22]); g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 15.5 * TILE); g.lineTo(MAP_W * TILE, 15.5 * TILE); g.stroke();
  g.setLineDash([]); g.lineWidth = 1;
})();

/* ---------------- game state ---------------- */
const player = {
  x: playerSpawn.x, y: playerSpawn.y, r: 12, hp: 100, stamina: 100,
  vx: 0, vy: 0, face: 0, speedMul: 1, exhausted: false,
  ammo: 6, cylinder: 6, reloading: 0, swingT: 0, swingCd: 0,
  grabbedBy: null, struggleT: 0, torchOn: false, flares: 1,
  walking: false, sprinting: false
};
const game = {
  phase: 'wave1', phaseT: 0, subT: 0, waveT: 0, toSpawn: 0, spawnT: 0, spawnSide: 0,
  kills: 0, shots: 0, time: 0, over: false, won: false,
  carFlipped: { left: false, right: false }, scooterBlown: false,
  noise: 0, noiseDecay: 60
};
const flags = { firstShot: false, wave2early: false, hordeCalled: false };
let zombies = [], corpses = [], items = [], particles = [], bloodPools = [], fires = [], sounds = [], floaters = [];
let cam = { x: player.x, y: player.y }, shakes = 0, redPulse = 0, grainSeed = 0;
let mode = 'title';

/* ---------------- audio ---------------- */
let AC = null, master = null, muted = false;
function audioInit() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.4; master.connect(AC.destination);
    const len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    const g = AC.createGain(); g.gain.value = 0.045;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  } catch (e) { AC = null; }
}
function tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, pan = 0) {
  if (!AC || muted) return;
  const o = AC.createOscillator(), g = AC.createGain(), p = AC.createStereoPanner ? AC.createStereoPanner() : null;
  o.type = type; o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(24, freq + slide), AC.currentTime + dur);
  g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  o.connect(g); if (p) { p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(master); } else g.connect(master);
  o.start(); o.stop(AC.currentTime + dur);
}
function burst(dur = 0.15, vol = 0.25, freq = 800, pan = 0) {
  if (!AC || muted) return;
  const len = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = AC.createBufferSource(); s.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const g = AC.createGain(); g.gain.value = vol;
  const p = AC.createStereoPanner ? AC.createStereoPanner() : null;
  s.connect(f); f.connect(g);
  if (p) { p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(master); } else g.connect(master);
  s.start();
}
function panOf(x, y) { return clamp((x - player.x) / (14 * TILE), -1, 1); }
const sfx = {
  groan: (x, y) => tone(rand(60, 105), 0.8, 'sawtooth', 0.10, -28, panOf(x, y)),
  shriek: (x, y) => tone(rand(600, 900), 0.45, 'sawtooth', 0.16, -500, panOf(x, y)),
  hit: () => { burst(0.1, 0.3, 480); tone(95, 0.1, 'square', 0.16, -40); },
  clang: () => { burst(0.18, 0.32, 1300); tone(220, 0.18, 'triangle', 0.12, -80); },
  shot: () => { burst(0.09, 0.55, 2200); tone(140, 0.16, 'square', 0.3, -90); setTimeout(() => burst(0.5, 0.14, 500), 90); },
  dryfire: () => burst(0.05, 0.12, 2000),
  reload: () => { burst(0.06, 0.15, 1600); setTimeout(() => burst(0.06, 0.15, 1200), 500); setTimeout(() => burst(0.08, 0.18, 900), 1300); },
  gore: () => { burst(0.3, 0.34, 240); tone(55, 0.3, 'sine', 0.22, -22); },
  pickup: () => tone(620, 0.08, 'triangle', 0.13, 200),
  eat: () => burst(0.18, 0.13, 350),
  heal: () => tone(430, 0.18, 'sine', 0.13, 150),
  hurt: () => { tone(130, 0.2, 'sawtooth', 0.24, -60); burst(0.1, 0.2, 300); },
  heart: () => { tone(52, 0.1, 'sine', 0.4); setTimeout(() => tone(48, 0.1, 'sine', 0.32), 120); },
  breath: () => burst(0.22, 0.05, 900),
  boom: () => { burst(0.6, 0.6, 160); tone(45, 0.7, 'sine', 0.4, -18); setTimeout(() => burst(0.8, 0.2, 320), 150); },
  roar: () => { for (let i = 0; i < 5; i++) setTimeout(() => tone(rand(55, 90), 1.1, 'sawtooth', 0.12, -25, rand(-0.8, 0.8)), i * 120); },
  win: () => { tone(262, 0.5, 'triangle', 0.18); setTimeout(() => tone(392, 0.8, 'triangle', 0.18), 300); },
  lose: () => tone(100, 1.4, 'sawtooth', 0.24, -55)
};

/* ---------------- noise system ---------------- */
function emitNoise(x, y, radius, loud = false) {
  sounds.push({ x, y, r: radius, t: loud ? 1.4 : 0.8, max: loud ? 1.4 : 0.8 });
  game.noise = Math.min(100, game.noise + (loud ? 45 : radius / 8));
  for (const z of zombies) {
    if (z.dead || z.state === 'hunt') continue;
    const d = dist(z.x, z.y, x, y);
    const hear = d < radius ? 1 : (d < radius * 1.6 ? 0.45 : 0); // muffled through nothing — open street
    if (hear > 0) {
      z.alert(x, y, hear);
      if (hear === 1 && z.state === 'calm') z.state = 'investigate';
    }
  }
}

/* ---------------- zombies ("freaks") ---------------- */
function makeFreak(x, y, kind = 'walker') {
  const z = {
    x, y, r: 12, kind, hp: kind === 'brute' ? 220 : kind === 'runner' ? 70 : 100,
    speed: kind === 'runner' ? 168 : kind === 'brute' ? 60 : 52,
    dmg: kind === 'brute' ? 26 : 14,
    state: 'calm', stateT: 0, tx: x, ty: y, phase: rand(0, 6),
    attackCd: 0, groanT: rand(2, 9), stuck: 0, lungeT: 0
  };
  z.alert = (sx, sy, strength) => {
    if (z.state === 'hunt') return;
    z.tx = sx + rand(-40, 40); z.ty = sy + rand(-40, 40);
    if (z.state !== 'investigate' || strength >= 1) z.state = strength >= 1 ? 'investigate' : 'suspicious';
    z.stateT = rand(6, 11);
  };
  zombies.push(z);
  return z;
}
function spawnFromEdge(side) {
  // spawn just inside a road edge: left (x=1) or right (x=MAP_W-2)
  const ty = randi(11, 20);
  const tx = side === 0 ? 1 : MAP_W - 2;
  const z = makeFreak(tx * TILE + 24, ty * TILE + 24, Math.random() < 0.22 ? 'runner' : 'walker');
  // during waves they emerge with your scent — the pack converges
  if (WAVES[game.phase]) z.alert(player.x + rand(-120, 120), player.y + rand(-90, 90), 1);
  return z;
}

function updateZombie(z, dt) {
  z.phase += dt; z.attackCd -= dt; z.groanT -= dt;
  if (z.groanT <= 0) { z.groanT = rand(4, 12); const d = dist(z.x, z.y, player.x, player.y); if (d < 16 * TILE) sfx.groan(z.x, z.y); }
  const d = dist(z.x, z.y, player.x, player.y);

  // vision (short, frontal-ish) — dark night
  const toP = Math.atan2(player.y - z.y, player.x - z.x);
  let sees = false;
  if (d < 3.2 * TILE && player.torchOn) sees = true;
  else if (d < 1.6 * TILE) sees = true;
  if (sees && z.state !== 'hunt') { z.state = 'hunt'; z.stateT = 8; sfx.shriek(z.x, z.y); }

  // lunge/attack
  if (z.state === 'hunt') {
    z.stateT -= dt;
    if (z.stateT <= 0 && d > 5 * TILE) { z.state = 'investigate'; z.tx = player.x; z.ty = player.y; }
    if (d > z.r + player.r + 4) {
      moveZombie(z, Math.atan2(player.y - z.y, player.x - z.x), z.speed * (z.kind === 'runner' ? 1 : 1.45) * dt);
    } else if (z.attackCd <= 0) {
      z.attackCd = z.kind === 'brute' ? 1.4 : 0.9;
      if (!player.grabbedBy) { player.grabbedBy = z; player.struggleT = 0; z.stateT = 99; sfx.shriek(z.x, z.y); redPulse = 1; }
    }
  } else if (z.state === 'investigate') {
    z.stateT -= dt;
    const a = Math.atan2(z.ty - z.y, z.tx - z.x);
    if (dist(z.x, z.y, z.tx, z.ty) > 26) moveZombie(z, a, z.speed * 1.15 * dt);
    else { z.state = 'suspicious'; z.stateT = rand(3, 6); }
    if (z.stateT <= 0) { z.state = 'suspicious'; z.stateT = rand(3, 6); }
  } else if (z.state === 'suspicious') {
    z.stateT -= dt;
    if (z.stateT <= 0) z.state = 'calm';
    moveZombie(z, z.phase * 0.7, z.speed * 0.5 * dt);
  } else {
    // calm wander; during waves, drift toward the player's end of the street
    if (Math.random() < dt * 0.5) {
      const bias = WAVES[game.phase] ? 0.65 : 0;
      const gx = Math.random() < bias ? player.x + rand(-260, 260) : z.x + rand(-140, 140);
      z.tx = gx; z.ty = clamp(z.y + rand(-60, 60), 11 * TILE, 20 * TILE);
    }
    if (dist(z.x, z.y, z.tx, z.ty) > 20) moveZombie(z, Math.atan2(z.ty - z.y, z.tx - z.x), z.speed * 0.45 * dt);
  }
  // separation
  for (const o of zombies) {
    if (o === z || o.dead) continue;
    const dd = dist(z.x, z.y, o.x, o.y);
    if (dd < 22 && dd > 0.01) {
      const push = (22 - dd) * 0.5, a = Math.atan2(o.y - z.y, o.x - z.x);
      const nx = z.x - Math.cos(a) * push, ny = z.y - Math.sin(a) * push;
      if (!solidPx(nx, z.y)) z.x = nx;
      if (!solidPx(z.x, ny)) z.y = ny;
    }
  }
}
function moveZombie(z, ang, step) {
  const nx = z.x + Math.cos(ang) * step, ny = z.y + Math.sin(ang) * step;
  let moved = false;
  if (!solidPx(nx, z.y)) { z.x = nx; moved = true; }
  if (!solidPx(z.x, ny)) { z.y = ny; moved = true; }
  if (!moved) { // slide along obstacle
    const t = rand(0, 1) < 0.5 ? 1 : -1;
    const sx = z.x + Math.cos(ang + t * Math.PI / 2) * step, sy = z.y + Math.sin(ang + t * Math.PI / 2) * step;
    if (!solidPx(sx, z.y)) z.x = sx;
    if (!solidPx(z.x, sy)) z.y = sy;
  }
}

/* ---------------- combat ---------------- */
function swing() {
  if (player.swingCd > 0 || player.grabbedBy || player.stamina < 12) return;
  player.swingCd = 0.55; player.swingT = 0.22;
  player.stamina = Math.max(0, player.stamina - 14);
  sfx.clang();
  emitNoise(player.x, player.y, 150);
  const reach = 58;
  let hitAny = false;
  for (const z of zombies) {
    if (z.dead) continue;
    const d = dist(z.x, z.y, player.x, player.y);
    if (d > reach + z.r) continue;
    const ang = Math.atan2(z.y - player.y, z.x - player.x);
    const diff = Math.abs(((ang - player.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (diff > 1.15) continue;
    hitAny = true;
    // stealth kill from behind on non-hunting freaks
    const facingMe = Math.abs(((Math.atan2(player.y - z.y, player.x - z.x) - (z.faceAng || 0) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (z.state !== 'hunt' && facingMe > 2.2) {
      killFreak(z, ang, true);
      log('stealth kill. quiet. clean.', 'good');
      continue;
    }
    z.hp -= randi(34, 52);
    z.x += Math.cos(ang) * 14; z.y += Math.sin(ang) * 14;
    if (z.state === 'calm' || z.state === 'suspicious') { z.state = 'hunt'; z.stateT = 10; }
    spurt(z.x, z.y, ang, 10);
    sfx.hit(); shakes = Math.max(shakes, 3);
    if (z.hp <= 0) killFreak(z, ang);
  }
  if (hitAny) emitNoise(player.x, player.y, 190);
}
function shoot() {
  if (player.reloading > 0 || player.grabbedBy) return;
  if (player.cylinder <= 0) { sfx.dryfire(); log('cylinder empty. R to reload.', 'bad'); return; }
  player.cylinder--; game.shots++;
  player.swingT = 0.12;
  sfx.shot(); shakes = Math.max(shakes, 7);
  emitNoise(player.x, player.y, 1500, true);
  if (!flags.firstShot) { flags.firstShot = true; }
  // hitscan
  const maxR = 900;
  let best = null, bestT = maxR;
  const aim = player.face;
  for (const z of zombies) {
    if (z.dead) continue;
    const rel = Math.atan2(z.y - player.y, z.x - player.x);
    const dd = dist(z.x, z.y, player.x, player.y);
    if (dd > maxR) continue;
    const off = Math.abs(((rel - aim + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const angularSize = Math.atan2(z.r + 4, Math.max(20, dd));
    if (off < angularSize && dd < bestT) { best = z; bestT = dd; }
  }
  // muzzle particle
  for (let i = 0; i < 6; i++) {
    const a = aim + rand(-0.2, 0.2);
    particles.push({ x: player.x + Math.cos(aim) * 20, y: player.y + Math.sin(aim) * 20, vx: Math.cos(a) * rand(120, 300), vy: Math.sin(a) * rand(120, 300), life: 0.12, max: 0.12, col: '#fcd34d', size: 3, drag: 0.9 });
  }
  if (best) {
    const headshot = Math.random() < 0.45;
    best.hp -= headshot ? 999 : randi(55, 85);
    const ang = Math.atan2(best.y - player.y, best.x - player.x);
    spurt(best.x, best.y, ang, headshot ? 22 : 14);
    if (headshot) { best.dead = true; gorePop(best); game.kills++; floatText(best.x, best.y, 'HEADSHOT', '#f87171'); }
    if (best.hp <= 0 && !best.dead) { killFreak(best, ang); }
    else if (!best.dead) { best.alert(player.x, player.y, 1); if (best.state !== 'hunt') { best.state = 'hunt'; best.stateT = 12; } }
  }
  // every gun shot may pull the next wave early
  if (game.phase === 'wave1' && game.shots === 1) {
    log('the shot rolls down the street. something answers.', 'bad');
    if (!flags.wave2early) { flags.wave2early = true; game.waveT = Math.min(game.waveT, 6); }
  }
  if (game.phase === 'lull2' || game.phase === 'wave2') {
    if (!flags.hordeCalled) { flags.hordeCalled = true; log('...that was loud enough to wake the dead. all of them.', 'bad'); callHorde(); }
  }
}
function reload() {
  if (player.reloading > 0 || player.cylinder === player.ammo || player.ammo === 0) return;
  player.reloading = 2.2; sfx.reload();
}
function killFreak(z, ang, stealth = false) {
  z.dead = true; game.kills++;
  goreBurst(z.x, z.y, stealth ? 14 : 24);
  corpses.push({ x: z.x, y: z.y, ang: ang + rand(-0.4, 0.4), t: 0, kind: z.kind });
  emitNoise(z.x, z.y, stealth ? 30 : 120);
  if (!stealth) log(pick(['it drops. the street drinks.', 'down. two more behind it.', 'wet. final.']), 'kill');
}
function gorePop(z) {
  goreBurst(z.x, z.y, 30);
  for (let i = 0; i < 8; i++) {
    const a = rand(0, Math.PI * 2);
    particles.push({ x: z.x, y: z.y, vx: Math.cos(a) * rand(60, 260), vy: Math.sin(a) * rand(60, 260), life: rand(0.4, 0.9), max: 0.9, col: '#e8d8c8', size: rand(2, 4), drag: 0.9, blood: true });
  }
  corpses.push({ x: z.x, y: z.y, ang: rand(0, 7), t: 0, kind: z.kind, popped: true });
}
function spurt(x, y, ang, n) {
  for (let i = 0; i < n; i++) {
    const a = ang + rand(-0.8, 0.8), s = rand(50, 220);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), max: 0.7, col: Math.random() < 0.5 ? COL.blood : COL.bloodDark, size: rand(2, 4), drag: 0.88, blood: true });
  }
}
function goreBurst(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(30, 260);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 1), max: 1, col: Math.random() < 0.6 ? COL.blood : COL.gore, size: rand(2, 5), drag: 0.87, blood: true });
  }
  bloodPools.push({ x, y, r: rand(16, 26), a: 0.7 });
  if (bloodPools.length > 240) bloodPools.shift();
  sfx.gore();
}
function explodeScooter() {
  game.scooterBlown = true;
  const sx = 29 * TILE + 24, sy = 18 * TILE + 24;
  sfx.boom(); shakes = 14; redPulse = 0.6;
  emitNoise(sx, sy, 1800, true);
  fires.push({ x: sx, y: sy, r: 3.2 * TILE, t: 22 });
  for (const z of zombies) {
    if (z.dead) continue;
    const d = dist(z.x, z.y, sx, sy);
    if (d < 3.4 * TILE) { z.hp = 0; killFreak(z, Math.atan2(z.y - sy, z.x - sx)); }
    else if (d < 6 * TILE) { z.hp -= 80; if (z.hp <= 0) killFreak(z, Math.atan2(z.y - sy, z.x - sx)); else z.alert(sx, sy, 1); }
  }
  for (let i = 0; i < 60; i++) {
    const a = rand(0, Math.PI * 2), s = rand(60, 420);
    particles.push({ x: sx, y: sy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.9), max: 0.9, col: pick(['#f97316', '#fdba74', '#7f1d1d']), size: rand(2, 5), drag: 0.9, fire: true });
  }
  setT(29, 18, T.ROAD);
  log('the scooter goes up like a diwali that went wrong.', 'kill');
}

/* ---------------- player update ---------------- */
const keys = {};
let mouse = { x: 0, y: 0, down: false };
function updatePlayer(dt) {
  // reload timer
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) {
      const need = 6 - player.cylinder, take = Math.min(need, player.ammo);
      player.cylinder += take; player.ammo -= take;
      log('six chances. make them count.', 'good');
    }
  }
  player.swingCd = Math.max(0, player.swingCd - dt);
  player.swingT = Math.max(0, player.swingT - dt);

  // grabbed: struggle (mash SPACE) — and it WILL bite if you don't
  if (player.grabbedBy) {
    const z = player.grabbedBy;
    if (z.dead) { player.grabbedBy = null; }
    else {
      player.struggleT += dt;
      player.grabT = (player.grabT || 0) + dt;
      if (player.grabT > 1.2) { // teeth, eventually
        player.grabT = 0.9;
        hurt(9);
      }
      player.x = z.x - Math.cos(Math.atan2(z.y - player.y, z.x - player.x)) * (z.r + player.r - 4);
      player.y = z.y - Math.sin(Math.atan2(z.y - player.y, z.x - player.x)) * (z.r + player.r - 4);
      if (keys['Space'] && player.struggleT > 0.22) {
        player.struggleT = 0; player.stamina = Math.max(0, player.stamina - 10);
        z.hp -= 8; player.mashes = (player.mashes || 0) + 1;
        burst(0.08, 0.2, 500); shakes = Math.max(shakes, 4);
        // two good shoves break the grab — knock it back and stagger it
        if (player.mashes >= 2 || z.hp <= 0) {
          const a = Math.atan2(z.y - player.y, z.x - player.x);
          if (z.hp <= 0) { killFreak(z, a); }
          const kx = z.x + Math.cos(a) * 46, ky = z.y + Math.sin(a) * 46;
          if (!solidPx(kx, z.y)) z.x = kx;
          if (!solidPx(z.x, ky)) z.y = ky;
          z.attackCd = 1.3;
          player.grabbedBy = null; player.grabT = 0; player.mashes = 0;
        } else if (player.stamina <= 0) die('dragged down while exhausted. the horde does not tire.');
      }
      redPulse = Math.max(redPulse, 0.5);
      return;
    }
  }
  player.grabT = 0;

  // movement with momentum
  let dx = 0, dy = 0;
  if (keys['KeyW']) dy -= 1; if (keys['KeyS']) dy += 1;
  if (keys['KeyA']) dx -= 1; if (keys['KeyD']) dx += 1;
  player.walking = !!(dx || dy);
  const wantSprint = (keys['ShiftLeft'] || keys['ShiftRight']) && player.walking && player.stamina > 5 && !player.exhausted;
  player.sprinting = wantSprint;
  const target = wantSprint ? 250 : 118;
  const acc = wantSprint ? 9 : 7;
  if (player.walking) {
    const l = Math.hypot(dx, dy); dx /= l; dy /= l;
    player.vx = lerp(player.vx, dx * target, Math.min(1, dt * acc));
    player.vy = lerp(player.vy, dy * target, Math.min(1, dt * acc));
  } else {
    player.vx = lerp(player.vx, 0, Math.min(1, dt * 10));
    player.vy = lerp(player.vy, 0, Math.min(1, dt * 10));
  }
  const nx = player.x + player.vx * dt, ny = player.y + player.vy * dt;
  if (!solidPx(nx, player.y)) player.x = nx; else player.vx = 0;
  if (!solidPx(player.x, ny)) player.y = ny; else player.vy = 0;
  player.x = clamp(player.x, TILE, (MAP_W - 1) * TILE);
  player.y = clamp(player.y, TILE, (MAP_H - 1) * TILE);

  // face mouse
  player.face = Math.atan2(mouse.y - VH / 2, mouse.x - VW / 2);

  // stamina
  if (player.sprinting) player.stamina = Math.max(0, player.stamina - dt * 16);
  else player.stamina = Math.min(100, player.stamina + dt * (player.walking ? 8 : 14));
  if (player.stamina <= 0 && !player.exhausted) { player.exhausted = true; log('lungs on fire. you cannot sprint.', 'bad'); }
  if (player.exhausted && player.stamina > 30) player.exhausted = false;
  if (player.stamina < 25 && Math.random() < dt * 2) sfx.breath();

  // footstep noise
  if (player.walking) {
    player.stepT = (player.stepT || 0) - dt;
    if (player.stepT <= 0) {
      player.stepT = player.sprinting ? 0.26 : 0.46;
      emitNoise(player.x, player.y, player.sprinting ? 210 : 46);
      burst(0.05, player.sprinting ? 0.1 : 0.04, 250, 0);
    }
  }
  // readable noise floor while moving + decay
  const floor = player.sprinting ? 78 : player.walking ? 24 : 0;
  game.noise = Math.max(game.noise, floor);
  game.noise = Math.max(0, game.noise - dt * game.noiseDecay);
}

/* ---------------- items ---------------- */
function scatterItems() {
  const spots = [];
  for (let i = 0; i < 300; i++) {
    const tx = randi(1, MAP_W - 2), ty = randi(9, 21);
    if (!SOLID.has(at(tx, ty))) spots.push({ x: tx * TILE + 24, y: ty * TILE + 24 });
  }
  const place = (type, n) => { for (let i = 0; i < n && spots.length; i++) { const s = spots.splice(randi(0, spots.length - 1), 1)[0]; items.push({ type, x: s.x, y: s.y, bob: rand(0, 6) }); } };
  place('ammo', 7);   // 2 rounds each
  place('food', 4);
  place('bandage', 4);
  place('flare', 2);
}
scatterItems();
function updateItems(dt) {
  for (const it of items) {
    it.bob += dt * 3;
    if (dist(it.x, it.y, player.x, player.y) < 28) {
      if (it.type === 'ammo') { player.ammo += 2; log('two loose rounds. someone counted these to stay sane.', 'good'); }
      if (it.type === 'food') { player.foodCarry = (player.foodCarry || 0) + 1; log('a tin of something. label gone. food is food.', 'good'); }
      if (it.type === 'bandage') { player.bandages = (player.bandages || 0) + 1; log('clean-ish bandage. (+1)', 'good'); }
      if (it.type === 'flare') { player.flares++; log('flare. fire answers noise with noise.', 'good'); }
      it.taken = true; sfx.pickup();
    }
  }
  items = items.filter(i => !i.taken);
}
function useFood() {
  if (!player.foodCarry) { log('nothing to eat.', 'bad'); return; }
  player.foodCarry--; player.hp = clamp(player.hp + 15, 0, 100); sfx.eat();
  log('you eat. it tastes like the tenth year.', 'good');
}
function useBandage() {
  if (!player.bandages) { log('no bandages.', 'bad'); return; }
  player.bandages--; player.hp = clamp(player.hp + 35, 0, 100); sfx.heal();
  log('wrapped tight. bleeding stops.', 'good');
}
function dropFlare() {
  if (player.flares <= 0) { log('no flares left.', 'bad'); return; }
  player.flares--;
  fires.push({ x: player.x + Math.cos(player.face) * 30, y: player.y + Math.sin(player.face) * 30, r: 110, t: 25, flare: true });
  emitNoise(player.x, player.y, 90);
  log('flare down. they hate the light. they hate it more than they fear it.', 'good');
}

/* ---------------- interactions (car flip, scooter) ---------------- */
function nearestFlipSpot() {
  // left cluster at (12,15) faces west lane; right cluster at (34,17)
  const spots = [
    { key: 'left', x: 13.5 * TILE, y: 15.5 * TILE, tx: 13, ty: 15, tx2: 13, ty2: 16 },
    { key: 'right', x: 35.5 * TILE, y: 17.5 * TILE, tx: 35, ty: 17, tx2: 35, ty2: 18 }
  ];
  let best = null, bd = 70;
  for (const s of spots) {
    if (game.carFlipped[s.key]) continue;
    const d = dist(player.x, player.y, s.x, s.y);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
let flipHold = 0;
function tryInteract(dt) {
  const s = nearestFlipSpot();
  if (s) {
    flipHold += dt;
    if (flipHold > 1.6) {
      game.carFlipped[s.key] = true;
      setT(s.tx, s.ty, T.BARRICADE); setT(s.tx2, s.ty2, T.BARRICADE);
      sfx.clang(); shakes = 6; emitNoise(player.x, player.y, 420, true);
      log('the car screams onto its side. a wall of steel. they heard it.', 'obj');
      flipHold = 0;
    }
  } else flipHold = 0;
  const nearScooter = dist(player.x, player.y, 29 * TILE + 24, 18 * TILE + 24) < 80 && !game.scooterBlown;
  if (nearScooter && keys['KeyE']) log('a scooter, a puddle of petrol, and one bullet. shoot it when they are close.', 'obj');
}

/* ---------------- waves ---------------- */
const WAVES = {
  wave1: { label: 'WAVE 1 — THE PACK', count: 5, dur: 55 },
  wave2: { label: 'WAVE 2 — THE STALKERS', count: 9, dur: 70 },
  wave3: { label: 'WAVE 3 — THE HORDE', count: 30, dur: 110 }
};
function setPhase(p) {
  game.phase = p; game.phaseT = 0;
  if (WAVES[p]) {
    game.waveT = WAVES[p].dur; game.toSpawn = WAVES[p].count; game.spawnT = 0.5;
    game.spawnSide = randi(0, 1);
    log(WAVES[p].label, 'obj');
    if (p === 'wave2') sfx.roar();
    if (p === 'wave3') { sfx.roar(); setTimeout(() => sfx.roar(), 700); }
  } else if (p === 'intro') {
    game.waveT = 45;
  } else if (p === 'lull1' || p === 'lull2') {
    game.waveT = p === 'lull1' ? 22 : 26;
    log(p === 'lull1' ? 'quiet. too quiet. loot fast — press F to drop a flare, flip a car (hold E).' : 'last lull. it is not over. it is never over.', 'obj');
  } else if (p === 'dawn') { win(); }
}
function callHorde() {
  if (game.phase === 'wave3') return;
  setPhase('wave3');
}
function updateWaves(dt) {
  game.phaseT += dt;
  if (game.phase === 'intro') {
    game.waveT -= dt;
    if (game.waveT <= 0) setPhase('wave1');
  } else if (WAVES[game.phase]) {
    // trickle spawn
    if (game.toSpawn > 0) {
      game.spawnT -= dt;
      const interval = game.phase === 'wave3' ? 1.1 : game.phase === 'wave2' ? 2.4 : 3.2;
      if (game.spawnT <= 0) {
        game.spawnT = interval * rand(0.7, 1.3);
        const z = spawnFromEdge(game.phase === 'wave3' ? randi(0, 1) : game.spawnSide);
        if (game.phase === 'wave2' && Math.random() < 0.3) z.speed *= 1.25;
        game.toSpawn--;
        if (game.phase === 'wave3' && game.toSpawn === Math.floor(WAVES.wave3.count / 2)) sfx.roar();
      }
    }
    game.waveT -= dt;
    // wave ends when timer done AND few remain
    const alive = zombies.length;
    if (game.waveT <= 0 || (game.waveT < WAVES[game.phase].dur * 0.4 && alive <= 1)) {
      if (game.phase === 'wave1') setPhase('lull1');
      else if (game.phase === 'wave2') setPhase('lull2');
      else setPhase('dawn');
    }
  } else if (game.phase === 'lull1') {
    game.waveT -= dt;
    if (game.waveT <= 0) setPhase('wave2');
  } else if (game.phase === 'lull2') {
    game.waveT -= dt;
    if (game.waveT <= 0) setPhase('wave3');
  }
}

/* ---------------- damage / death / win ---------------- */
function hurt(dmg) {
  player.hp -= dmg; redPulse = Math.max(redPulse, 0.7); shakes = Math.max(shakes, 5);
  sfx.hurt();
  spurt(player.x, player.y, rand(0, 7), 6);
  if (player.hp <= 0) die(player.grabbedBy ? 'torn open while something held you still.' : 'you bled out on the wet asphalt.');
}
function die(cause) {
  if (game.over) return;
  game.over = true; mode = 'dead'; sfx.lose();
  document.getElementById('death-cause').textContent = cause;
  document.getElementById('death-stats').textContent = `KILLS ${game.kills} · SHOTS ${game.shots} · SURVIVED ${Math.round(game.time)}s · WAVE ${game.phase.replace('wave', '')}`;
  document.getElementById('overlay-death').classList.remove('hidden');
}
function win() {
  if (game.over) return;
  game.over = true; mode = 'won'; sfx.win();
  const score = game.kills * 100 + player.cylinder * 50 + player.ammo * 25 + Math.round(player.hp) * 10;
  document.getElementById('win-score').textContent = `SCORE ${score} — KILLS ${game.kills} · AMMO LEFT ${player.cylinder + player.ammo} · HP ${Math.round(player.hp)} · ${Math.round(game.time)}s`;
  document.getElementById('overlay-win').classList.remove('hidden');
}

/* ---------------- log & floaters ---------------- */
const logEl = document.getElementById('log');
function log(text, cls = '') {
  const div = document.createElement('div');
  div.className = 'logline ' + cls;
  div.textContent = '> ' + text;
  logEl.appendChild(div);
  while (logEl.children.length > 6) logEl.removeChild(logEl.firstChild);
  setTimeout(() => { div.style.opacity = '0'; }, 8000);
}
function floatText(x, y, text, col) { floaters.push({ x, y, text, col, t: 1 }); }

/* ---------------- input ---------------- */
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) startGame();
  if (e.code === 'KeyM') { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.4; log(muted ? 'muted.' : 'sound on.'); }
  if (mode !== 'play') return;
  if (e.code === 'KeyR') reload();
  if (e.code === 'KeyQ') useFood();
  if (e.code === 'KeyC') useBandage();
  if (e.code === 'KeyF') dropFlare();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  mouse.down = true;
  if (mode === 'title') { startGame(); return; }
  if (mode !== 'play') return;
  if (keys['Digit2']) shoot(); else swing();
});
window.addEventListener('mouseup', () => { mouse.down = false; });

/* ---------------- particles etc ---------------- */
function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= p.drag; p.vy *= p.drag;
    p.life -= dt;
    if (p.blood && p.life <= 0 && Math.random() < 0.14) {
      bloodPools.push({ x: p.x, y: p.y, r: rand(3, 8), a: 0.5 });
      if (bloodPools.length > 240) bloodPools.shift();
    }
  }
  particles = particles.filter(p => p.life > 0);
  for (const f of fires) f.t -= dt;
  fires = fires.filter(f => f.t > 0);
  for (const s of sounds) s.t -= dt;
  sounds = sounds.filter(s => s.t > 0);
  for (const fl of floaters) { fl.t -= dt; fl.y -= dt * 26; }
  floaters = floaters.filter(f => f.t > 0);
}
function updateFires(dt) {
  for (const f of fires) {
    for (const z of zombies) {
      if (z.dead) continue;
      const d = dist(z.x, z.y, f.x, f.y);
      if (d < f.r) {
        z.hp -= dt * (f.flare ? 26 : 34);
        // fear: push away
        const a = Math.atan2(z.y - f.y, z.x - f.x);
        const push = dt * 90;
        const nx = z.x + Math.cos(a) * push, ny = z.y + Math.sin(a) * push;
        if (!solidPx(nx, z.y)) z.x = nx;
        if (!solidPx(z.x, ny)) z.y = ny;
        if (Math.random() < dt * 2) spurt(z.x, z.y, rand(0, 7), 1);
        if (z.hp <= 0) killFreak(z, rand(0, 7));
      }
    }
    if (Math.random() < dt * 12) {
      particles.push({ x: f.x + rand(-f.r * 0.4, f.r * 0.4), y: f.y + rand(-f.r * 0.3, f.r * 0.3), vx: rand(-12, 12), vy: rand(-60, -20), life: rand(0.3, 0.8), max: 0.8, col: pick([COL.fire, COL.fireCore, '#dc2626']), size: rand(2, 4), drag: 0.95, fire: true });
    }
  }
}

/* ---------------- camera ---------------- */
function updateCam(dt) {
  cam.x = lerp(cam.x, player.x, Math.min(1, dt * 5));
  cam.y = lerp(cam.y, player.y, Math.min(1, dt * 5));
}

/* ---------------- rendering ---------------- */
let stateTime = 0;
function render() {
  grainSeed = (grainSeed + 1) % 1000;
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, VW, VH);
  ctx.save();
  const shx = shakes > 0 ? rand(-shakes, shakes) : 0, shy = shakes > 0 ? rand(-shakes, shakes) : 0;
  ctx.translate(VW / 2 - cam.x + shx, VH / 2 - cam.y + shy);

  ctx.drawImage(groundCanvas, 0, 0);

  // flipped barricades (drawn over ground)
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    if (at(tx, ty) === T.BARRICADE) {
      ctx.fillStyle = COL.barricade;
      ctx.fillRect(tx * TILE + 2, ty * TILE + 8, TILE - 4, TILE - 16);
      ctx.strokeStyle = 'rgba(249,115,22,0.25)'; ctx.strokeRect(tx * TILE + 2.5, ty * TILE + 8.5, TILE - 5, TILE - 17);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(tx * TILE + 2, ty * TILE + TILE - 12, TILE - 4, 4);
    }
  }

  // blood pools
  for (const b of bloodPools) {
    ctx.fillStyle = COL.bloodDark; ctx.globalAlpha = b.a * 0.8;
    ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r, b.r * 0.7, 0.4, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // corpses (dark, flatten over time)
  for (const c of corpses) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.ang);
    ctx.fillStyle = c.popped ? '#2a0d10' : '#1d1116';
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#160d10'; ctx.beginPath(); ctx.arc(12, 0, 5, 0, 7); ctx.fill();
    ctx.restore();
  }

  // items
  for (const it of items) {
    const bobY = Math.sin(it.bob) * 2;
    ctx.save(); ctx.translate(it.x, it.y + bobY);
    if (it.type === 'ammo') { ctx.fillStyle = '#a16207'; ctx.fillRect(-6, -4, 12, 8); ctx.fillStyle = '#fbbf24'; ctx.fillRect(-5, -3, 3, 6); ctx.fillRect(0, -3, 3, 6); }
    if (it.type === 'food') { ctx.fillStyle = '#57534e'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill(); ctx.strokeStyle = '#a8a29e'; ctx.stroke(); }
    if (it.type === 'bandage') { ctx.fillStyle = '#e7e5e4'; ctx.fillRect(-6, -4, 12, 8); ctx.fillStyle = '#b91c1c'; ctx.fillRect(-1, -4, 2, 8); }
    if (it.type === 'flare') { ctx.fillStyle = '#b91c1c'; ctx.fillRect(-2, -7, 4, 14); ctx.fillStyle = '#f97316'; ctx.fillRect(-2, -7, 4, 3); }
    ctx.restore();
  }

  // sound pings
  for (const s of sounds) {
    const a = s.t / s.max;
    ctx.strokeStyle = `rgba(167,139,250,${a * 0.35})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, (1 - a) * s.r * 0.5 + 10, 0, 7); ctx.stroke();
  }

  // fires (under entities for glow)
  for (const f of fires) {
    const flick = 1 + Math.sin(stateTime * 13 + f.x) * 0.06;
    const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * flick);
    grad.addColorStop(0, 'rgba(249,115,22,0.28)');
    grad.addColorStop(0.5, 'rgba(220,38,38,0.10)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * flick, 0, 7); ctx.fill();
    if (f.flare) { ctx.fillStyle = COL.fireCore; ctx.fillRect(f.x - 2, f.y - 6, 4, 10); }
  }

  // entities sorted by y
  const ents = [];
  for (const z of zombies) ents.push({ y: z.y, draw: () => drawFreak(z) });
  ents.push({ y: player.y, draw: drawPlayer });
  ents.sort((a, b) => a.y - b.y);
  for (const e of ents) e.draw();

  // particles
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1) * (p.fire ? 0.9 : 1);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // floaters
  for (const fl of floaters) {
    ctx.globalAlpha = clamp(fl.t, 0, 1);
    ctx.fillStyle = fl.col; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillText(fl.text, fl.x, fl.y);
  }
  ctx.globalAlpha = 1;

  // rain
  ctx.strokeStyle = 'rgba(140,160,200,0.13)';
  ctx.beginPath();
  for (let i = 0; i < 70; i++) {
    const rx = (i * 197 + (stateTime * 330) % (VW + 240)) % (VW + 240) - 120 + cam.x * 0.25;
    const ry = (i * 131 + (stateTime * 620) % (VH + 240)) % (VH + 240) - 120 + cam.y * 0.25;
    ctx.moveTo(rx, ry); ctx.lineTo(rx - 5, ry + 16);
  }
  ctx.stroke();

  ctx.restore();

  renderLighting();
  renderFogAndGrain();
  renderWaveBanner();
  renderCrosshair();
}

function drawPlayer() {
  const { x, y } = player;
  ctx.save(); ctx.translate(x, y);
  if (player.swingT > 0.08) {
    ctx.strokeStyle = 'rgba(196,181,253,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 54, player.face - 1, player.face + 1); ctx.stroke();
    ctx.lineWidth = 1;
  }
  ctx.rotate(player.face);
  // jacket body
  ctx.fillStyle = '#232030';
  ctx.beginPath(); ctx.ellipse(2, 0, 13, 10, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#4c435f'; ctx.stroke();
  // head
  ctx.fillStyle = '#38304a'; ctx.beginPath(); ctx.arc(4, 0, 6, 0, 7); ctx.fill();
  // weapon
  if (keys['Digit2'] && !player.reloading) { // revolver
    ctx.fillStyle = '#9aa0b5'; ctx.fillRect(6, 2, 17, 4);
    ctx.fillStyle = '#5b5e6d'; ctx.fillRect(5, 1, 6, 6);
  } else { // pipe
    ctx.strokeStyle = '#7d8296'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(5, 4); ctx.lineTo(22, 4); ctx.stroke(); ctx.lineWidth = 1;
  }
  ctx.restore();
}
function drawFreak(z) {
  ctx.save(); ctx.translate(z.x, z.y);
  const wob = Math.sin(z.phase * (z.state === 'hunt' ? 10 : 3.4)) * 2;
  // awareness indicator above
  if (z.state === 'investigate') {
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
    ctx.fillText('?', 0, -22 - Math.sin(stateTime * 4) * 2);
  } else if (z.state === 'suspicious') {
    ctx.fillStyle = 'rgba(251,191,36,0.55)'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('?', 0, -20);
  } else if (z.state === 'hunt') {
    const pulse = 0.6 + Math.sin(stateTime * 9) * 0.4;
    ctx.fillStyle = `rgba(220,38,38,${pulse})`; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
    ctx.fillText('◉', 0, -24);
  }
  const ang = z.state === 'hunt' ? Math.atan2(player.y - z.y, player.x - z.x) : (z.faceAng !== undefined ? z.faceAng : 0);
  ctx.rotate(ang);
  z.faceAng = ang;
  const bodyCol = z.kind === 'runner' ? '#26141c' : z.kind === 'brute' ? '#1a1420' : '#1e1a20';
  const rimCol = z.kind === 'runner' ? '#7f1d1d' : z.kind === 'brute' ? '#3b1d4d' : '#37323f';
  ctx.fillStyle = bodyCol;
  ctx.beginPath(); ctx.ellipse(2, wob, 13, 10, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = rimCol; ctx.stroke();
  // head
  ctx.fillStyle = rimCol; ctx.beginPath(); ctx.arc(4, wob, 5.5, 0, 7); ctx.fill();
  if (z.state === 'hunt') { // arms reaching
    ctx.strokeStyle = bodyCol; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(4, -5); ctx.lineTo(21, -2 + Math.sin(z.phase * 12) * 2); ctx.moveTo(4, 5); ctx.lineTo(21, 2 - Math.sin(z.phase * 12) * 2); ctx.stroke(); ctx.lineWidth = 1;
  }
  // hp bar only when damaged
  if (z.hp < (z.kind === 'brute' ? 220 : z.kind === 'runner' ? 70 : 100)) {
    ctx.rotate(-ang);
    const w = 26, hpw = clamp(z.hp / (z.kind === 'brute' ? 220 : z.kind === 'runner' ? 70 : 100), 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-w / 2, -20, w, 3);
    ctx.fillStyle = '#7f1d1d'; ctx.fillRect(-w / 2, -20, w * hpw, 3);
  }
  ctx.restore();
}

/* lighting */
const lightCanvas = document.createElement('canvas');
const lctx = lightCanvas.getContext('2d');
function renderLighting() {
  if (lightCanvas.width !== VW || lightCanvas.height !== VH) { lightCanvas.width = VW; lightCanvas.height = VH; }
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, VW, VH);
  lctx.fillStyle = 'rgba(3,4,10,0.86)';
  lctx.fillRect(0, 0, VW, VH);
  lctx.globalCompositeOperation = 'destination-out';
  let radius = 170;
  if (player.torchOn) radius = 285;
  cutLight(lctx, VW / 2, VH / 2, radius, 0.95);
  for (const f of fires) {
    const sx = f.x - cam.x + VW / 2, sy = f.y - cam.y + VH / 2;
    if (sx > -300 && sx < VW + 300 && sy > -300 && sy < VH + 300)
      cutLight(lctx, sx, sy, f.r * 1.5 + Math.sin(stateTime * 10 + f.x) * 8, 0.95);
  }
  lctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(lightCanvas, 0, 0);
}
function cutLight(c, x, y, r, strength) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(0.5, `rgba(0,0,0,${strength * 0.55})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
}
function renderFogAndGrain() {
  // fog depth fade at screen edges
  const g = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.25, VW / 2, VH / 2, Math.max(VW, VH) * 0.72);
  g.addColorStop(0, 'rgba(10,12,20,0)');
  g.addColorStop(1, 'rgba(10,12,20,0.75)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  // film grain
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 130; i++) {
    const gx = (i * 977 + grainSeed * 137) % VW;
    const gy = (i * 761 + grainSeed * 271) % VH;
    ctx.fillStyle = i % 2 ? '#fff' : '#000';
    ctx.fillRect(gx, gy, 2, 2);
  }
  ctx.globalAlpha = 1;
  // red pulse when grabbed/hurt
  if (redPulse > 0) {
    ctx.fillStyle = `rgba(153,27,27,${redPulse * 0.28})`;
    ctx.fillRect(0, 0, VW, VH);
  }
  // vignette by hp
  const squeeze = clamp((100 - player.hp) * 0.32, 0, 44);
  ctx.fillStyle = 'rgba(2,2,6,1)';
  ctx.beginPath();
  ctx.rect(0, 0, VW, VH);
  ctx.ellipse(VW / 2, VH / 2, VW / 2 - squeeze, VH / 2 - squeeze * 1.2, 0, 0, 7);
  ctx.fill('evenodd');
}
function renderWaveBanner() {
  if (game.phaseT > 4 || game.over) return;
  const a = game.phaseT < 0.5 ? game.phaseT * 2 : game.phaseT > 3 ? (4 - game.phaseT) : 1;
  ctx.globalAlpha = clamp(a, 0, 1);
  ctx.font = 'bold 30px monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = game.phase === 'wave3' ? '#dc2626' : '#c4b5fd';
  const label = WAVES[game.phase] ? WAVES[game.phase].label : game.phase === 'intro' ? 'NIGHT ONE' : 'A BRIEF QUIET';
  ctx.fillText(label, VW / 2, VH * 0.24);
  ctx.font = '12px monospace'; ctx.fillStyle = '#6d6a85';
  ctx.fillText(game.phase === 'intro' ? 'the door is open. the street is not empty.' : '', VW / 2, VH * 0.24 + 24);
  ctx.globalAlpha = 1;
}
function renderCrosshair() {
  if (mode !== 'play') return;
  const x = mouse.x, y = mouse.y;
  const gun = keys['Digit2'];
  const spread = gun ? (player.reloading > 0 ? 18 : 8) : 10;
  ctx.strokeStyle = gun ? 'rgba(251,191,36,0.9)' : 'rgba(167,139,250,0.8)';
  ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.stroke();
  for (const [dx2, dy2] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x + dx2 * spread, y + dy2 * spread);
    ctx.lineTo(x + dx2 * (spread + 6), y + dy2 * (spread + 6));
    ctx.stroke();
  }
}

/* ---------------- HUD ---------------- */
const hpFill = document.getElementById('hp-fill');
const stFill = document.getElementById('st-fill');
const ammoEl = document.getElementById('ammo');
const noiseFill = document.getElementById('noise-fill');
const invEl = document.getElementById('inv');
const objectiveEl = document.getElementById('objective');
let lastPhaseLabel = '';
function updateHUD() {
  hpFill.style.width = clamp(player.hp, 0, 100) + '%';
  hpFill.style.background = player.hp < 30 ? '#dc2626' : '#8b5cf6';
  stFill.style.width = clamp(player.stamina, 0, 100) + '%';
  noiseFill.style.width = clamp(game.noise, 0, 100) + '%';
  noiseFill.style.background = game.noise > 70 ? '#dc2626' : game.noise > 40 ? '#fbbf24' : '#8b5cf6';
  let cyl = '';
  for (let i = 0; i < 6; i++) cyl += i < player.cylinder ? '●' : '○';
  ammoEl.innerHTML = cyl + ` <span style="color:var(--dim)">+${player.ammo}</span>` + (player.reloading > 0 ? ' <span class="rl">RELOADING</span>' : '');
  invEl.innerHTML =
    `<span class="inv-item">FOOD ×${player.foodCarry || 0} <i>Q</i></span>` +
    `<span class="inv-item">BANDAGE ×${player.bandages || 0} <i>C</i></span>` +
    `<span class="inv-item">FLARE ×${player.flares} <i>F</i></span>` +
    `<span class="inv-item">1 PIPE · 2 REVOLVER</span>`;
  const label = WAVES[game.phase] ? `${WAVES[game.phase].label} — ${Math.max(0, Math.ceil(game.waveT))}s` :
    game.phase === 'intro' ? 'SCAVENGE — wave 1 in ' + Math.ceil(game.waveT) + 's' :
    game.phase === 'dawn' ? 'DAWN — GET OUT' :
    `${game.phase === 'lull1' ? 'LULL — wave 2 in ' : 'LULL — HORDE in '}${Math.ceil(game.waveT)}s`;
  objectiveEl.textContent = label;
  if (WAVES[game.phase] && lastPhaseLabel !== WAVES[game.phase].label) lastPhaseLabel = WAVES[game.phase].label;
}

/* ---------------- world tick ---------------- */
function updateWorld(dt) {
  game.time += dt;
  updateWaves(dt);
  updateFires(dt);
  // ambient groans from fog
  if (Math.random() < dt * 0.4) {
    const z = pick(zombies);
    if (z && dist(z.x, z.y, player.x, player.y) < 18 * TILE) sfx.groan(z.x, z.y);
  }
  // heartbeat
  if (player.hp < 30) {
    player.beatT = (player.beatT || 0) - dt;
    if (player.beatT <= 0) { player.beatT = 1.0; sfx.heart(); }
  }
  if (keys['KeyE']) tryInteract(dt); else flipHold = 0;
  redPulse = Math.max(0, redPulse - dt * 1.4);
  shakes = Math.max(0, shakes - dt * 26);
}

/* ---------------- main loop ---------------- */
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  tick(dt);
  requestAnimationFrame(loop);
}
function tick(dt) {
  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) resize();
  stateTime += dt;
  if (mode === 'play') {
    updatePlayer(dt);
    for (const z of zombies) if (!z.dead) updateZombie(z, dt);
    zombies = zombies.filter(z => !z.dead);
    updateItems(dt);
    updateParticles(dt);
    updateWorld(dt);
    updateCam(dt);
    updateHUD();
  }
  if (mode !== 'title') render();
}
requestAnimationFrame(loop);
// debug hook: manually step game time (used by automated tests; harmless in prod)
window.__pump = (seconds, step = 0.05) => { for (let t = 0; t < seconds; t += step) tick(step); };

/* ---------------- start / restart ---------------- */
function startGame() {
  if (mode !== 'title') return;
  audioInit();
  document.getElementById('overlay-title').classList.add('hidden');
  mode = 'play';
  setPhase('intro');
  log('the lock turns. it has not turned in 3,653 days.', 'obj');
  log('1 = pipe (quiet) · 2 = revolver (loud) · R reload · hold E to flip a car', 'obj');
}
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-retry').addEventListener('click', () => location.reload());

})();
