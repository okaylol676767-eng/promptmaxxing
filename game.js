/* ============================================================
   POST APOCALYPTIC INDIA — prototype v0.1
   "Are they gone?" — a survival prototype. Dark aesthetic.
   Written by: Helpless people.
   ============================================================ */
(() => {
'use strict';

/* ---------------- helpers ---------------- */
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const pick = (arr) => arr[randi(0, arr.length - 1)];

/* ---------------- constants ---------------- */
const T = { ROAD: 0, GRASS: 1, BUILDING: 2, RUBBLE: 3, WATER: 4, PUDDLE: 5, BARRICADE: 7, FENCE: 8, STALL: 9, CONCRETE: 10, INTERIOR: 11, CAR: 12, TREE: 13, DOOR: 6 };
const SOLID = new Set([T.BUILDING, T.WATER, T.BARRICADE, T.FENCE, T.STALL, T.CAR, T.TREE, T.RUBBLE]);
const TILE = 48;
const MAP_W = 48, MAP_H = 42;

const COL = {
  bg: '#0a0a0f', road: '#232329', roadAlt: '#26262d', grass: '#0d1a12', grassAlt: '#0f2016',
  building: '#171226', buildingEdge: '#2a2140', concrete: '#2b2b33', concreteAlt: '#282831',
  interior: '#1c1728', water: '#0a1622', puddle: '#101c2a', rubble: '#3a3a42',
  fence: '#3d3d4c', stall: '#241a30', car: '#1f2430', tree: '#101d14',
  blood: '#7a0e14', bloodDark: '#4a080c', gore: '#5c0a10', neon: '#8b5cf6', neonSoft: '#a78bfa',
  text: '#c4b5fd', dim: '#6d6a85'
};

/* ---------------- canvas ---------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let VW = 0, VH = 0;
function resize() {
  VW = canvas.width = window.innerWidth;
  VH = canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

/* ---------------- world map ---------------- */
const map = new Uint8Array(MAP_W * MAP_H);
const at = (tx, ty) => (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) ? T.BUILDING : map[ty * MAP_W + tx];
const setT = (tx, ty, t) => { if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) map[ty * MAP_W + tx] = t; };
const solidAt = (tx, ty) => SOLID.has(at(tx, ty));
const solidPx = (x, y) => solidAt(Math.floor(x / TILE), Math.floor(y / TILE));

function rect(x0, y0, w, h, t) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setT(x, y, t);
}
function building(x0, y0, w, h, door) {
  rect(x0, y0, w, h, T.BUILDING);
  rect(x0 + 1, y0 + 1, w - 2, h - 2, T.INTERIOR);
  if (door === 'S') { setT(x0 + (w >> 1), y0 + h - 1, T.DOOR); setT(x0 + (w >> 1), y0 + h, T.DOOR); }
  if (door === 'N') { setT(x0 + (w >> 1), y0, T.DOOR); setT(x0 + (w >> 1), y0 - 1, T.DOOR); }
  if (door === 'E') { setT(x0 + w - 1, y0 + (h >> 1), T.DOOR); setT(x0 + w, y0 + (h >> 1), T.DOOR); }
  if (door === 'W') { setT(x0, y0 + (h >> 1), T.DOOR); setT(x0 - 1, y0 + (h >> 1), T.DOOR); }
}

function buildWorld() {
  rect(0, 0, MAP_W, MAP_H, T.ROAD);
  // grass veins
  for (let i = 0; i < 90; i++) {
    const gx = randi(1, MAP_W - 2), gy = randi(1, MAP_H - 2);
    if (at(gx, gy) === T.ROAD) setT(gx, gy, T.GRASS);
  }
  // flyover band across the middle
  rect(0, 19, MAP_W, 4, T.CONCRETE);
  for (let x = 3; x < MAP_W; x += 7) rect(x, 19, 1, 4, T.BUILDING); // pillars
  setT(24, 19, T.CONCRETE); setT(24, 20, T.CONCRETE); setT(24, 21, T.CONCRETE); setT(24, 22, T.CONCRETE);
  // HOME QUARTER (start) — bottom-left house
  building(4, 32, 7, 6, 'N');
  rect(3, 31, 9, 1, T.GRASS);
  // neighbor ruins
  building(14, 33, 6, 5, 'W');
  building(26, 34, 8, 6, 'N');
  building(38, 32, 7, 7, 'W');
  // cars & barricades
  const cars = [[10, 26], [31, 27], [20, 8], [35, 13], [7, 17], [43, 24], [16, 38], [29, 5]];
  cars.forEach(([cx, cy]) => setT(cx, cy, T.CAR));
  [[12, 30], [12, 29], [22, 23], [33, 30]].forEach(([bx, by]) => setT(bx, by, T.BARRICADE));
  // MARKET — top right
  for (let i = 0; i < 6; i++) {
    const sx = 30 + (i % 3) * 4, sy = 4 + Math.floor(i / 3) * 4;
    rect(sx, sy, 2, 2, T.STALL);
  }
  building(42, 2, 5, 5, 'W');
  // CLINIC — top left (with interior ward)
  building(4, 3, 9, 7, 'S');
  // small blocks
  building(18, 5, 6, 6, 'S');
  building(28, 12, 5, 5, 'E');
  building(8, 12, 5, 5, 'E');
  building(36, 38, 6, 3, 'N');
  building(2, 24, 5, 4, 'E');
  // pond — bottom right
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const dx = (x - 40) / 5.5, dy = (y - 37) / 3.4;
    if (dx * dx + dy * dy < 1) setT(x, y, T.WATER);
  }
  // trees + rubble scatter
  for (let i = 0; i < 60; i++) {
    const tx = randi(1, MAP_W - 2), ty = randi(1, MAP_H - 2);
    if (at(tx, ty) === T.GRASS) setT(tx, ty, T.TREE);
  }
  for (let i = 0; i < 70; i++) {
    const tx = randi(1, MAP_W - 2), ty = randi(1, MAP_H - 2);
    if (at(tx, ty) === T.ROAD && dist(tx, ty, 7, 34) > 6) setT(tx, ty, T.RUBBLE);
  }
  // puddles
  for (let i = 0; i < 40; i++) {
    const tx = randi(1, MAP_W - 2), ty = randi(1, MAP_H - 2);
    if (at(tx, ty) === T.ROAD) setT(tx, ty, T.PUDDLE);
  }
  // radio tower base — right edge
  rect(45, 18, 3, 6, T.FENCE);
  setT(46, 21, T.CONCRETE); // gate tile (walkable)
  // fence around map
  for (let x = 0; x < MAP_W; x++) { setT(x, 0, T.FENCE); setT(x, MAP_H - 1, T.FENCE); }
  for (let y = 0; y < MAP_H; y++) { setT(0, y, T.FENCE); setT(MAP_W - 1, y, T.FENCE); }
}
buildWorld();

/* ground pre-render */
const groundCanvas = document.createElement('canvas');
groundCanvas.width = MAP_W * TILE; groundCanvas.height = MAP_H * TILE;
(function prerenderGround() {
  const g = groundCanvas.getContext('2d');
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const t = at(tx, ty), x = tx * TILE, y = ty * TILE;
    let base = COL.road;
    if (t === T.ROAD || t === T.DOOR) base = (tx + ty) % 2 ? COL.road : COL.roadAlt;
    else if (t === T.GRASS) base = (tx * 7 + ty * 13) % 3 ? COL.grass : COL.grassAlt;
    else if (t === T.BUILDING) base = COL.building;
    else if (t === T.INTERIOR) base = COL.interior;
    else if (t === T.CONCRETE) base = (tx + ty) % 2 ? COL.concrete : COL.concreteAlt;
    else if (t === T.WATER) base = COL.water;
    else if (t === T.PUDDLE) base = COL.puddle;
    else if (t === T.STALL) base = COL.stall;
    else if (t === T.CAR) base = COL.car;
    else if (t === T.TREE) base = COL.grass;
    else base = COL.road;
    g.fillStyle = base; g.fillRect(x, y, TILE, TILE);
    // texture speckle
    g.fillStyle = 'rgba(255,255,255,0.02)';
    for (let s = 0; s < 3; s++) g.fillRect(x + randi(2, 44), y + randi(2, 44), 2, 2);
    if (t === T.BUILDING) { g.strokeStyle = 'rgba(139,92,246,0.10)'; g.strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3); }
    if (t === T.FENCE) { g.strokeStyle = COL.fence; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + 8); g.lineTo(x + TILE, y + 8); g.moveTo(x, y + 26); g.lineTo(x + TILE, y + 26); g.moveTo(x, y + 40); g.lineTo(x + TILE, y + 40); g.stroke(); g.lineWidth = 1; }
    if (t === T.WATER) { g.fillStyle = 'rgba(139,92,246,0.05)'; g.fillRect(x, y + 10, TILE, 2); g.fillRect(x, y + 30, TILE, 1); }
    if (t === T.PUDDLE) { g.fillStyle = 'rgba(120,160,220,0.06)'; g.beginPath(); g.ellipse(x + 24, y + 24, 20, 13, 0.3, 0, 7); g.fill(); }
    if (t === T.RUBBLE) { g.fillStyle = COL.rubble; for (let r = 0; r < 5; r++) g.fillRect(x + randi(4, 38), y + randi(4, 38), randi(4, 10), randi(3, 8)); }
    if (t === T.STALL) { g.strokeStyle = 'rgba(167,139,250,0.25)'; g.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8); }
    if (t === T.CAR) { g.fillStyle = '#141821'; g.fillRect(x + 4, y + 8, TILE - 8, TILE - 16); g.fillStyle = '#0d1017'; g.fillRect(x + 8, y + 12, 10, 10); g.fillRect(x + 28, y + 12, 10, 10); }
    if (t === T.TREE) { g.fillStyle = '#0c1810'; g.beginPath(); g.arc(x + 24, y + 24, 17, 0, 7); g.fill(); g.fillStyle = '#13271a'; g.beginPath(); g.arc(x + 20, y + 20, 9, 0, 7); g.fill(); }
  }
  // cracks on road
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 80; i++) {
    const x = rand(0, groundCanvas.width), y = rand(0, groundCanvas.height);
    g.beginPath(); g.moveTo(x, y);
    let cx = x, cy = y;
    for (let s = 0; s < 4; s++) { cx += rand(-22, 22); cy += rand(-22, 22); g.lineTo(cx, cy); }
    g.stroke();
  }
})();

/* ---------------- state ---------------- */
const HOME = { x: 7.5 * TILE, y: 34 * TILE };
const player = {
  x: HOME.x, y: HOME.y, r: 13, hp: 100, hunger: 82, instinct: 50, fear: 10,
  food: 1, med: 0, meat: 0, hasPart: false, torch: false, bleeding: false,
  swingT: 0, face: -Math.PI / 2, sprint: false, moving: false
};
const flags = {
  chotu: 'hungry', chotuGiveT: 0, iyer: 'need', iyerHealT: 0, wardFed: false,
  lady: 'none', extraction: false, extractT: 0, deaths: 0, honored: new Set(), doorOpened: false
};
let memorials = [];
let zombies = [], npcs = [], items = [], particles = [], bloodPools = [], flares = [];
let shakes = 0, whisperTimer = 0, rumorTimer = 6, nightSpawnT = 0, heartbeatT = 0;

const keys = {};
let mouse = { x: 0, y: 0, down: false };
let mode = 'title';

/* ---------------- spawn helpers ---------------- */
function walkableSpawn(minDistFromPlayer, tries = 200) {
  for (let i = 0; i < tries; i++) {
    const tx = randi(2, MAP_W - 3), ty = randi(2, MAP_H - 3);
    if (SOLID.has(at(tx, ty))) continue;
    const px = tx * TILE + 24, py = ty * TILE + 24;
    if (dist(px, py, player.x, player.y) < minDistFromPlayer) continue;
    return { x: px, y: py };
  }
  return { x: 24 * TILE, y: 10 * TILE };
}

function spawnZombie(type, pos) {
  const p = pos || walkableSpawn(320);
  const z = { type, x: p.x, y: p.y, r: 13, hp: 100, aggro: false, atkT: 0, dir: rand(0, 7), wanderT: 0, phase: rand(0, 6), revealed: false };
  if (type === 'rotter') z.speed = 42, z.dmg = 12;
  if (type === 'lurker') z.speed = 30, z.dmg = 20;
  if (type === 'sprinter') z.speed = 125, z.dmg = 10, z.hp = 55;
  if (type === 'patient') z.speed = 0, z.dmg = 22;
  zombies.push(z);
  return z;
}

function spawnItem(type, pos) { items.push({ type, x: pos.x, y: pos.y, bob: rand(0, 6) }); }

/* ---------------- population ---------------- */
(function populate() {
  for (let i = 0; i < 24; i++) spawnZombie('rotter');
  for (let i = 0; i < 8; i++) spawnZombie('lurker');
  for (let i = 0; i < 3; i++) spawnZombie('sprinter');
  // patients: one in clinic ward, one wild
  spawnZombie('patient', { x: 8.2 * TILE, y: 6.5 * TILE });
  spawnZombie('patient', walkableSpawn(500));
  // items
  for (let i = 0; i < 14; i++) spawnItem('food', walkableSpawn(160));
  for (let i = 0; i < 5; i++) spawnItem('med', walkableSpawn(200));
  for (let i = 0; i < 4; i++) spawnItem('flare', walkableSpawn(160));
  // radio part — hidden in a market stall
  const stalls = [];
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) if (at(tx, ty) === T.STALL) stalls.push({ x: tx * TILE + 24, y: ty * TILE + 60 });
  spawnItem('part', pick(stalls));
  // NPCs
  npcs = [
    { id: 'chotu', name: 'CHOTU', x: 17.5 * TILE, y: 18.2 * TILE, col: '#fbbf24' },
    { id: 'iyer', name: 'DR. IYER', x: 8.5 * TILE, y: 11.5 * TILE, col: '#67e8f9' },
    { id: 'ward', name: 'WARD PATIENT', x: 11.2 * TILE, y: 6.5 * TILE, col: '#94a3b8' },
    { id: 'lady', name: 'SIGNAL LADY', x: 46.5 * TILE, y: 21.5 * TILE, col: '#f472b6' }
  ];
})();

/* ---------------- audio (procedural) ---------------- */
let AC = null, masterGain = null, muted = false;
function audioInit() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = AC.createGain(); masterGain.gain.value = 0.35; masterGain.connect(AC.destination);
    // rain loop
    const len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = AC.createGain(); g.gain.value = 0.05;
    src.connect(f); f.connect(g); g.connect(masterGain); src.start();
  } catch (e) { AC = null; }
}
function tone(freq, dur, type = 'sine', vol = 0.2, slide = 0) {
  if (!AC || muted) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), AC.currentTime + dur);
  g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  o.connect(g); g.connect(masterGain); o.start(); o.stop(AC.currentTime + dur);
}
function noiseBurst(dur = 0.15, vol = 0.25, freq = 800) {
  if (!AC || muted) return;
  const len = AC.sampleRate * dur, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = AC.createBufferSource(); s.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const g = AC.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(masterGain); s.start();
}
const sfx = {
  groan: () => tone(rand(65, 110), 0.7, 'sawtooth', 0.12, -30),
  hit: () => { noiseBurst(0.12, 0.3, 500); tone(90, 0.12, 'square', 0.18, -40); },
  gore: () => { noiseBurst(0.3, 0.35, 260); tone(60, 0.3, 'sine', 0.25, -25); },
  swing: () => noiseBurst(0.08, 0.12, 1800),
  pickup: () => tone(660, 0.09, 'triangle', 0.15, 220),
  eat: () => noiseBurst(0.2, 0.15, 350),
  hurt: () => { tone(140, 0.2, 'sawtooth', 0.25, -70); noiseBurst(0.1, 0.2, 300); },
  shriek: () => tone(900, 0.5, 'sawtooth', 0.2, -650),
  heal: () => tone(440, 0.2, 'sine', 0.15, 160),
  heart: () => { tone(55, 0.1, 'sine', 0.4); setTimeout(() => tone(50, 0.1, 'sine', 0.35), 130); },
  win: () => { tone(330, 0.4, 'triangle', 0.2); setTimeout(() => tone(494, 0.5, 'triangle', 0.2), 250); },
  lose: () => tone(110, 1.2, 'sawtooth', 0.25, -60)
};

/* ---------------- terminal log & rumors ---------------- */
const logEl = document.getElementById('log');
function log(text, cls = '') {
  const div = document.createElement('div');
  div.className = 'logline ' + cls;
  div.textContent = '> ' + text;
  logEl.appendChild(div);
  while (logEl.children.length > 7) logEl.removeChild(logEl.firstChild);
  setTimeout(() => { div.style.opacity = '0'; }, 9000);
}
const FLAVOR = [
  'the tram bell rang. nobody rings it anymore.',
  'ten years. the calendar on the wall says 3653.',
  'the water tank drips. three drops. pause. three drops.',
  'somewhere, a temple loudspeaker still cycles static.',
  'the flyover hums with flies.',
  'you smell pickle brine. or is it rot?',
  'chotu scratched days into the pillar. he stopped counting.',
  'the streetlights are dead. all of them. always.'
];
function dirName(dx, dy) {
  const a = Math.atan2(dy, dx), oct = Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][oct];
}
function rumor() {
  const near = zombies.filter(z => !z.dead && dist(z.x, z.y, player.x, player.y) < 12 * TILE)
    .sort((a, b) => dist(a.x, a.y, player.x, player.y) - dist(b.x, b.y, player.x, player.y))[0];
  const lieChance = player.instinct < 40 ? 0.45 : player.instinct < 70 ? 0.15 : 0.03;
  if (near) {
    if (Math.random() < lieChance) { log(pick(['all clear. nothing stirs.', 'the street is empty. you are safe.', 'silence. blessed silence.']), 'lie'); return; }
    const d = Math.round(dist(near.x, near.y, player.x, player.y) / TILE);
    const verbs = { rotter: 'something shuffles', lurker: 'something waits', sprinter: 'something is running', patient: 'you hear breathing' };
    log(`${verbs[near.type] || 'something moves'} ${dirName(near.x - player.x, near.y - player.y)}, ~${d} paces.`);
    return;
  }
  if (Math.random() < 0.35 && player.instinct >= 55) {
    // true "all clear"
    log('for once, the quiet is honest. nothing within sight.');
    return;
  }
  log(pick(FLAVOR));
}

/* ---------------- input ---------------- */
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) startGame();
  if (e.code === 'KeyM') { muted = !muted; if (masterGain) masterGain.gain.value = muted ? 0 : 0.35; log(muted ? 'audio muted.' : 'audio on.'); }
  if (mode !== 'play') return;
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyQ') eat();
  if (e.code === 'KeyH') heal();
  if (e.code === 'KeyF') useFlareOrTorch();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; if (mode === 'title') startGame(); } });
window.addEventListener('mouseup', () => { mouse.down = false; });

/* ---------------- actions ---------------- */
function eat() {
  if (player.food <= 0) { log('your bag is empty. your stomach is not.', 'bad'); return; }
  player.food--; player.hunger = clamp(player.hunger + 38, 0, 100);
  player.instinct = clamp(player.instinct + 4, 0, 100);
  sfx.eat(); log('you eat. slowly. ten years of practice.', 'good');
}
function heal() {
  if (player.med <= 0) { log('no medkits. tear a shirt. pray.', 'bad'); return; }
  player.med--; player.hp = clamp(player.hp + 40, 0, 100); player.bleeding = false;
  sfx.heal(); log('wrapped, taped, breathing. it will hold.', 'good');
}
function useFlareOrTorch() {
  if (player.torch) { player.torch = false; log('torch off. the dark closes in.'); return; }
  if (player.flareCount > 0) {
    player.flareCount--;
    flares.push({ x: player.x, y: player.y, t: 30, flick: rand(0, 9) });
    log('flare down. red light. wet street.', 'good'); sfx.pickup();
    return;
  }
  player.torch = true; log('torch on. battery is dying. everything is.', 'good');
}
function interact() {
  // NPC
  let best = null, bd = 64;
  for (const n of npcs) { const d = dist(n.x, n.y, player.x, player.y); if (d < bd) { bd = d; best = n; } }
  if (best) { openDialog(best); return; }
  // memorial
  for (const m of memorials) {
    if (dist(m.x, m.y, player.x, player.y) < 64 && !flags.honored.has(m.id)) {
      flags.honored.add(m.id);
      player.instinct = clamp(player.instinct + 15, 0, 100);
      log(`you light a candle for ${m.name}. the dark feels one degree safer. (+15 instinct)`, 'good');
      sfx.heal(); return;
    }
  }
  log('nothing here but damp and concrete.');
}

/* ---------------- NPC dialogs ---------------- */
const dlg = document.getElementById('dialog');
const dlgTitle = document.getElementById('dlg-title');
const dlgBody = document.getElementById('dlg-body');
const dlgOpts = document.getElementById('dlg-opts');
function openDialog(n) {
  mode = 'dialog';
  dlg.classList.remove('hidden');
  dlgTitle.textContent = n.name; dlgTitle.style.color = n.col;
  dlgBody.textContent = dialogText(n);
  dlgOpts.innerHTML = '';
  dialogOptions(n).forEach(([label, fn]) => {
    const b = document.createElement('button');
    b.textContent = label; b.className = 'dlg-btn';
    b.onclick = () => { fn(); closeDialog(); };
    dlgOpts.appendChild(b);
  });
  const leave = document.createElement('button');
  leave.textContent = '[ leave ]'; leave.className = 'dlg-btn dim';
  leave.onclick = closeDialog;
  dlgOpts.appendChild(leave);
}
function closeDialog() { dlg.classList.add('hidden'); if (mode === 'dialog') mode = 'play'; }

function dialogText(n) {
  if (n.id === 'chotu') {
    if (flags.chotu === 'hungry') return '"uncle... three days since i ate. the pillar says it rained 900 times while you were gone."';
    if (flags.chotu === 'vendor') return '"i found tins in the drowned shop! take one when the timer is kind. i count for you now."';
    return '"..." he does not look at you. the pillar counts only rain now.';
  }
  if (n.id === 'iyer') {
    if (flags.iyer === 'need') return '"two medkits. the ward turned last night. i can save the rest of them — maybe. bring them to me."';
    if (flags.iyer === 'done') return '"sit. let me look at you." (free treatment — E again any time you are hurt)';
    return 'the clinic is quiet in the wrong way.';
  }
  if (n.id === 'ward') {
    if (!flags.wardFed) return 'he is folded under a blanket, terribly still. his chest... does it move? (instinct may know.)';
    return 'an empty bed. a smell of meat. what did you do.';
  }
  if (n.id === 'lady') {
    if (flags.lady === 'none') return '"i can call the boats. need a radio part — the stalls in the market ate theirs. find one and i will pull you all out."';
    if (flags.lady === 'asked') return '"any working radio part. check the market stalls. i will keep the static singing."';
    if (flags.lady === 'ready') return 'extraction at dawn. survive until sunrise. she counts seconds on the radio.';
    return '...';
  }
  return '...';
}
function dialogOptions(n) {
  const opts = [];
  if (n.id === 'chotu') {
    if (flags.chotu === 'hungry') {
      opts.push(['[ give food ]  (needs 1 food)', () => {
        if (player.food >= 1) { player.food--; flags.chotu = 'vendor'; flags.chotuGiveT = 40; player.instinct = clamp(player.instinct + 15, 0, 100); log('chotu eats like the world ended. for him, it did. (+15 instinct)', 'good'); }
        else log('your hands are empty. so are his.', 'bad');
      }]);
      opts.push(['[ walk away ]', () => { flags.chotu = 'abandoned'; player.instinct = clamp(player.instinct - 10, 0, 100); log('you leave a child on a flyover. the whisper counts it. (-10 instinct)', 'bad'); }]);
    } else if (flags.chotu === 'vendor' && flags.chotuGiveT <= 0) {
      opts.push(['[ take a tin from chotu ]', () => { player.food++; flags.chotuGiveT = 60; log('chotu grins through the grime. "counted it myself."', 'good'); }]);
    }
  }
  if (n.id === 'iyer') {
    if (flags.iyer === 'need') {
      opts.push(['[ hand over 2 medkits ]', () => {
        if (player.med >= 2) { player.med -= 2; flags.iyer = 'done'; player.instinct = clamp(player.instinct + 20, 0, 100); log('"thank you." the ward lights blink on. free treatment, forever. (+20 instinct)', 'good'); }
        else log('you need two medkits. the clinic shelves were looted years ago.', 'bad');
      }]);
    } else if (flags.iyer === 'done') {
      opts.push(['[ accept treatment ]', () => {
        player.hp = 100; player.bleeding = false; sfx.heal();
        log('stitched and sticky. alive. "try to keep it that way."', 'good');
      }]);
    }
  }
  if (n.id === 'ward' && !flags.wardFed) {
    opts.push(['[ place meat beside him ]  (needs 1 meat)', () => {
      if (player.meat >= 1) {
        player.meat--; flags.wardFed = true;
        const iyer = npcs.find(q => q.id === 'iyer');
        if (iyer) { memorials.push({ id: 'iyer', name: 'DR. IYER', x: iyer.x, y: iyer.y }); npcs = npcs.filter(q => q.id !== 'iyer'); }
        spawnZombie('sprinter', { x: 9 * TILE, y: 7 * TILE });
        player.instinct = clamp(player.instinct - 10, 0, 100); player.fear = 100;
        log('the blanket moves. the ward screams once, briefly. the game remembers. (-10 instinct)', 'bad');
        sfx.shriek();
      } else log('no meat. mercy by default.', 'bad');
    }]);
  }
  if (n.id === 'lady') {
    if (flags.lady === 'none') { flags.lady = 'asked'; log('NEW OBJECTIVE: find a radio part in the market stalls.', 'obj'); }
    if (flags.lady === 'asked' && player.hasPart) {
      opts.push(['[ hand over the radio part ]', () => {
        player.hasPart = false; flags.lady = 'ready'; flags.extraction = true; flags.extractT = 45;
        log('"THAT IS IT. boats at dawn. forty-five seconds. do not die tired."', 'obj');
        sfx.win();
      }]);
    }
  }
  return opts;
}

/* ---------------- combat & gore ---------------- */
function swing() {
  if (player.swingT > 0) return;
  player.swingT = 0.45; sfx.swing();
  const reach = 62;
  for (const z of zombies) {
    if (z.dead) continue;
    const d = dist(z.x, z.y, player.x, player.y);
    if (d > reach + z.r) continue;
    const ang = Math.atan2(z.y - player.y, z.x - player.x);
    let diff = Math.abs(((ang - player.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (diff > 1.1) continue;
    const dmg = randi(30, 50);
    z.hp -= dmg;
    z.x += Math.cos(ang) * 16; z.y += Math.sin(ang) * 16;
    spurtBlood(z.x, z.y, ang);
    sfx.hit(); shakes = Math.max(shakes, 3);
    if (z.type !== 'patient') z.aggro = true;
    if (z.hp <= 0) killZombie(z, ang);
  }
}
function spurtBlood(x, y, ang) {
  for (let i = 0; i < 14; i++) {
    const a = ang + rand(-0.9, 0.9), s = rand(40, 190);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.8), max: 0.8, col: Math.random() < 0.5 ? COL.blood : COL.bloodDark, size: rand(2, 4), drag: 0.9, blood: true });
  }
}
function goreBurst(x, y) {
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2), s = rand(30, 240);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 1.1), max: 1.1, col: Math.random() < 0.6 ? COL.blood : COL.gore, size: rand(2, 5), drag: 0.88, blood: true });
  }
  bloodPools.push({ x, y, r: rand(18, 30), a: 0.75 });
  if (bloodPools.length > 260) bloodPools.shift();
  if (Math.random() < 0.55) spawnItem('meat', { x: x + rand(-10, 10), y: y + rand(-10, 10) });
  sfx.gore();
}
function killZombie(z, ang) {
  z.dead = true;
  goreBurst(z.x, z.y);
  player.instinct = clamp(player.instinct + 8, 0, 100);
  log('it drops. the street drinks. (+8 instinct)', 'kill');
}

/* ---------------- zombie AI ---------------- */
function updateZombies(dt) {
  for (const z of zombies) {
    if (z.dead) continue;
    const d = dist(z.x, z.y, player.x, player.y);
    z.phase += dt;
    // patient reveal
    if (z.type === 'patient') {
      if (!z.revealed && d < 3 * TILE) {
        if (player.instinct >= 60 && !z.warned) { z.warned = true; log('it is breathing. IT IS BREATHING.', 'bad'); }
        if (d < 1.4 * TILE) {
          z.revealed = true; z.type = 'sprinter'; z.speed = 125; z.hp = 55; z.dmg = 10;
          sfx.shriek(); player.fear = clamp(player.fear + 30, 0, 100);
          log('THE CORPSE WAS NOT A CORPSE.', 'bad');
        }
      }
      continue;
    }
    // aggro rules
    if (!z.aggro) {
      if (z.type === 'rotter' && d < 8 * TILE) { z.aggro = true; if (Math.random() < 0.5) sfx.groan(); }
      if (z.type === 'lurker' && d < 2.2 * TILE) { z.aggro = true; }
      if (z.type === 'sprinter' && d < 10 * TILE && player.moving) { z.aggro = true; z.loseT = 6; sfx.shriek(); }
    }
    if (z.aggro) {
      if (z.type === 'sprinter' && !player.moving) { z.loseT -= dt; if (z.loseT <= 0) { z.aggro = false; } }
      const a = Math.atan2(player.y - z.y, player.x - z.x);
      const nx = z.x + Math.cos(a) * z.speed * dt, ny = z.y + Math.sin(a) * z.speed * dt;
      if (!solidPx(nx, z.y)) z.x = nx;
      if (!solidPx(z.x, ny)) z.y = ny;
      z.attackCd = (z.attackCd || 0) - dt;
      if (d < z.r + player.r + 6 && z.attackCd <= 0) {
        z.attackCd = z.type === 'sprinter' ? 0.8 : 1.1;
        hurtPlayer(z.dmg, a);
      }
    } else {
      // wander
      z.wanderT -= dt;
      if (z.wanderT <= 0) { z.wanderT = rand(1, 3); z.dir = rand(0, Math.PI * 2); z.wSpeed = z.type === 'lurker' ? 0 : rand(8, 20); }
      if (z.wSpeed) {
        const nx = z.x + Math.cos(z.dir) * z.wSpeed * dt, ny = z.y + Math.sin(z.dir) * z.wSpeed * dt;
        if (!solidPx(nx, z.y)) z.x = nx; else z.wanderT = 0;
        if (!solidPx(z.x, ny)) z.y = ny; else z.wanderT = 0;
      }
    }
  }
  // separation
  for (let i = 0; i < zombies.length; i++) {
    const a = zombies[i]; if (a.dead) continue;
    for (let j = i + 1; j < zombies.length; j++) {
      const b = zombies[j]; if (b.dead) continue;
      const d = dist(a.x, a.y, b.x, b.y);
      if (d < 24 && d > 0.01) {
        const push = (24 - d) / 2, ang = Math.atan2(b.y - a.y, b.x - a.x);
        if (!solidPx(a.x - Math.cos(ang) * push, a.y - Math.sin(ang) * push)) { a.x -= Math.cos(ang) * push * 0.5; a.y -= Math.sin(ang) * push * 0.5; }
        if (!solidPx(b.x + Math.cos(ang) * push, b.y + Math.sin(ang) * push)) { b.x += Math.cos(ang) * push * 0.5; b.y += Math.sin(ang) * push * 0.5; }
      }
    }
  }
  zombies = zombies.filter(z => !z.dead);
}

function hurtPlayer(dmg, ang) {
  player.hp -= dmg; player.fear = clamp(player.fear + 14, 0, 100);
  player.instinct = clamp(player.instinct - 4, 0, 100);
  if (!player.bleeding && Math.random() < 0.35) { player.bleeding = true; log('you are bleeding. find a medkit. (H)', 'bad'); }
  spurtBlood(player.x, player.y, ang + Math.PI);
  sfx.hurt(); shakes = Math.max(shakes, 6);
  if (player.hp <= 0) die();
}

/* ---------------- death & memorials ---------------- */
function die() {
  mode = 'dead'; sfx.lose();
  flags.deaths++;
  memorials.push({ id: 'm' + flags.deaths, name: 'SURVIVOR #' + flags.deaths, x: player.x, y: player.y });
  document.getElementById('death-cause').textContent =
    player.hunger <= 0 ? 'starvation. the house kept its record.' :
    player.bleeding ? 'bled out in the street. the street kept the blood.' :
    'torn apart. the patient ones waited, and waited, and waited.';
  document.getElementById('overlay-death').classList.remove('hidden');
}
function respawn() {
  document.getElementById('overlay-death').classList.add('hidden');
  player.x = HOME.x; player.y = HOME.y; player.hp = 100; player.hunger = 70;
  player.fear = 10; player.bleeding = false; player.food = 1; player.med = 0;
  player.hasPart = flags.lady === 'ready' ? false : player.hasPart && flags.lady !== 'ready';
  player.torch = false;
  mode = 'play';
  log('day ' + (3653 + flags.deaths) + '. someone else opens the door.', 'obj');
  rumorTimer = 4;
}

/* ---------------- items pickup ---------------- */
function updateItems(dt) {
  for (const it of items) {
    it.bob += dt * 3;
    if (dist(it.x, it.y, player.x, player.y) < 30) {
      if (it.type === 'food') { player.food++; log('biscuits. dry as the decade. (+1 food)', 'good'); }
      if (it.type === 'med') { player.med++; log('medkit. factory sealed. miracle. (+1 medkit)', 'good'); }
      if (it.type === 'meat') { player.meat++; log('a slab of... something. it could be bait. it could be lunch.', 'good'); }
      if (it.type === 'flare') { player.flareCount = (player.flareCount || 0) + 1; log('flare. red star in a tin. (+1 flare, F to use)', 'good'); }
      if (it.type === 'part') { player.hasPart = true; log('A RADIO PART. the signal lady needs this. bring it to the tower (E).', 'obj'); }
      it.taken = true; sfx.pickup();
    }
  }
  items = items.filter(i => !i.taken);
}

/* ---------------- player update ---------------- */
function updatePlayer(dt) {
  let dx = 0, dy = 0;
  if (keys['KeyW']) dy -= 1; if (keys['KeyS']) dy += 1;
  if (keys['KeyA']) dx -= 1; if (keys['KeyD']) dx += 1;
  player.moving = !!(dx || dy);
  player.sprint = !!(keys['ShiftLeft'] || keys['ShiftRight']) && player.moving && player.hunger > 8;
  const spd = (player.sprint ? 235 : 150) * (player.hunger <= 0 ? 0.55 : 1);
  if (player.moving) {
    const l = Math.hypot(dx, dy); dx /= l; dy /= l;
    const nx = player.x + dx * spd * dt, ny = player.y + dy * spd * dt;
    if (!solidPx(nx, player.y)) player.x = nx;
    if (!solidPx(player.x, ny)) player.y = ny;
    player.x = clamp(player.x, TILE, MAP_W * TILE - TILE);
    player.y = clamp(player.y, TILE, MAP_H * TILE - TILE);
    if (player.sprint) player.hunger = clamp(player.hunger - dt * 1.4, 0, 100);
  }
  player.face = Math.atan2(mouse.y - (VH / 2 + (player.y - cam.y)), mouse.x - (VW / 2 + (player.x - cam.x)));
  player.swingT = Math.max(0, player.swingT - dt);
  if (mouse.down && mode === 'play') swing();

  // survival ticks
  player.hunger = clamp(player.hunger - dt * 0.35, 0, 100);
  if (player.hunger <= 0) { player.hp -= dt * 1.5; if (player.hp <= 0) die(); }
  if (player.bleeding) {
    player.hp -= dt * 2; player.instinct = clamp(player.instinct - dt * 0.5, 0, 100);
    if (player.hp <= 0) die();
  }
  // fear
  let nearZ = 999;
  for (const z of zombies) if (!z.dead) nearZ = Math.min(nearZ, dist(z.x, z.y, player.x, player.y));
  if (nearZ < 6 * TILE) player.fear = clamp(player.fear + dt * 10, 0, 100);
  else player.fear = clamp(player.fear - dt * 3, 0, 100);
  if (player.fear > 70) player.instinct = clamp(player.instinct - dt, 0, 100);
  // door first-open moment
  if (!flags.doorOpened && dist(player.x, player.y, HOME.x, HOME.y - TILE) > TILE * 3) {
    flags.doorOpened = true;
    log('DAY 3653. you open the door. the air is a question.', 'obj');
  }
  // chotu vendor timer
  if (flags.chotuGiveT > 0) flags.chotuGiveT -= dt;
  // extraction countdown
  if (flags.extraction) {
    flags.extractT -= dt;
    if (flags.extractT <= 0) win();
  }
}

function win() {
  mode = 'won'; sfx.win();
  const lost = [];
  if (flags.chotu === 'abandoned') lost.push('CHOTU — still on the flyover, counting rain');
  if (flags.wardFed) lost.push('DR. IYER — the ward you fed');
  if (!flags.honored.size && memorials.length) lost.push(memorials.length + ' unnamed survivor(s) — unvisited candles');
  document.getElementById('win-lost').textContent = lost.length ? 'THE MEMORIAL WALL:\n' + lost.join('\n') : 'you brought everyone you could. the boats are real. the dawn is real.';
  document.getElementById('overlay-win').classList.remove('hidden');
}

/* ---------------- day/night ---------------- */
const DAY_LEN = 150;
let dayT = DAY_LEN * 0.28;
function darkness() {
  const t = dayT / DAY_LEN;
  if (t < 0.25) return 0.35 + t * 0.4;        // dawn->morning
  if (t < 0.6) return 0.28;                   // day
  if (t < 0.8) return 0.28 + (t - 0.6) * 2.2; // dusk
  return 0.72 + Math.min(0.13, (t - 0.8) * 0.6); // night
}
function isNight() { return dayT / DAY_LEN > 0.78 || dayT / DAY_LEN < 0.12; }

/* ---------------- camera ---------------- */
const cam = { x: player.x, y: player.y };
function updateCam(dt) {
  const tx = player.x, ty = player.y;
  cam.x += (tx - cam.x) * Math.min(1, dt * 6);
  cam.y += (ty - cam.y) * Math.min(1, dt * 6);
}

/* ---------------- render ---------------- */
function render() {
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, VW, VH);
  ctx.save();
  const shx = shakes > 0 ? rand(-shakes, shakes) : 0, shy = shakes > 0 ? rand(-shakes, shakes) : 0;
  ctx.translate(VW / 2 - cam.x + shx, VH / 2 - cam.y + shy);

  // ground
  ctx.drawImage(groundCanvas, 0, 0);

  // blood pools
  for (const b of bloodPools) {
    ctx.fillStyle = COL.bloodDark; ctx.globalAlpha = b.a * 0.8;
    ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r, b.r * 0.7, 0.4, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // items
  for (const it of items) {
    const bobY = Math.sin(it.bob) * 2;
    ctx.save(); ctx.translate(it.x, it.y + bobY);
    if (it.type === 'food') { ctx.fillStyle = '#8a6d3b'; ctx.fillRect(-6, -5, 12, 10); ctx.fillStyle = '#c9a15a'; ctx.fillRect(-6, -5, 12, 3); }
    if (it.type === 'med') { ctx.fillStyle = '#e8e8ee'; ctx.fillRect(-7, -6, 14, 12); ctx.fillStyle = '#c0392b'; ctx.fillRect(-2, -4, 4, 8); ctx.fillRect(-5, -1, 10, 3); }
    if (it.type === 'meat') { ctx.fillStyle = COL.blood; ctx.beginPath(); ctx.ellipse(0, 0, 8, 5, 0.5, 0, 7); ctx.fill(); ctx.fillStyle = '#e0d6c8'; ctx.fillRect(-1, -8, 3, 6); }
    if (it.type === 'flare') { ctx.fillStyle = '#c0392b'; ctx.fillRect(-2, -8, 4, 14); ctx.fillStyle = '#f97316'; ctx.fillRect(-2, -8, 4, 3); }
    if (it.type === 'part') { ctx.fillStyle = '#22d3ee'; ctx.fillRect(-8, -6, 16, 12); ctx.fillStyle = '#0e7490'; ctx.fillRect(-5, -3, 10, 6); ctx.fillStyle = '#a5f3fc'; ctx.fillRect(-1, -9, 2, 4); }
    ctx.restore();
  }

  // radio tower
  drawTower();

  // entities sorted by y
  const ents = [];
  for (const z of zombies) ents.push({ y: z.y, draw: () => drawZombie(z) });
  for (const n of npcs) ents.push({ y: n.y, draw: () => drawNPC(n) });
  for (const m of memorials) ents.push({ y: m.y, draw: () => drawMemorial(m) });
  ents.push({ y: player.y, draw: drawPlayer });
  ents.sort((a, b) => a.y - b.y);
  for (const e of ents) e.draw();

  // particles
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // rain
  ctx.strokeStyle = 'rgba(140,160,200,0.16)';
  ctx.beginPath();
  for (let i = 0; i < 60; i++) {
    const rx = (i * 197 + (stateTime * 320) % (VW + 200)) % (VW + 200) - 100 + cam.x * 0.2;
    const ry = (i * 131 + (stateTime * 560) % (VH + 200)) % (VH + 200) - 100 + cam.y * 0.2;
    ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 14);
  }
  ctx.stroke();

  ctx.restore();

  // lighting overlay
  renderLighting();

  // crosshair
  if (mode === 'play') {
    ctx.strokeStyle = 'rgba(167,139,250,0.8)';
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 7, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mouse.x - 11, mouse.y); ctx.lineTo(mouse.x - 3, mouse.y);
    ctx.moveTo(mouse.x + 3, mouse.y); ctx.lineTo(mouse.x + 11, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 11); ctx.lineTo(mouse.x, mouse.y - 3);
    ctx.moveTo(mouse.x, mouse.y + 3); ctx.lineTo(mouse.x, mouse.y + 11); ctx.stroke();
  }
}

function drawTower() {
  const x = 46.5 * TILE, y = 17.2 * TILE;
  ctx.strokeStyle = '#3d3d4c'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 22, y + 40); ctx.lineTo(x - 6, y - 120);
  ctx.moveTo(x + 22, y + 40); ctx.lineTo(x + 6, y - 120);
  ctx.moveTo(x - 14, y + 10); ctx.lineTo(x + 14, y + 10);
  ctx.moveTo(x - 11, y - 30); ctx.lineTo(x + 11, y - 30);
  ctx.moveTo(x - 8, y - 70); ctx.lineTo(x + 8, y - 70);
  ctx.stroke(); ctx.lineWidth = 1;
  // blinking light
  const blink = Math.sin(stateTime * 3) > 0;
  if (blink) { ctx.fillStyle = '#f43f5e'; ctx.beginPath(); ctx.arc(x, y - 124, 3, 0, 7); ctx.fill(); }
}

function drawPlayer() {
  const { x, y } = player;
  ctx.save(); ctx.translate(x, y);
  // swing arc
  if (player.swingT > 0.25) {
    ctx.strokeStyle = 'rgba(196,181,253,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 58, player.face - 1.0, player.face + 1.0); ctx.stroke();
    ctx.lineWidth = 1;
  }
  ctx.rotate(player.face);
  // body
  ctx.fillStyle = '#221c33';
  ctx.beginPath(); ctx.ellipse(2, 0, 13, 10, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#8b5cf6'; ctx.stroke();
  // head
  ctx.fillStyle = '#3b2f52'; ctx.beginPath(); ctx.arc(4, 0, 6, 0, 7); ctx.fill();
  // pipe (weapon)
  ctx.strokeStyle = '#9aa0b5'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(22, 4); ctx.stroke(); ctx.lineWidth = 1;
  ctx.restore();
  if (player.bleeding) { // drip
    ctx.fillStyle = COL.blood;
    ctx.fillRect(x + rand(-6, 6), y + 12, 2, 4);
  }
}

function drawZombie(z) {
  ctx.save(); ctx.translate(z.x, z.y);
  if (z.type === 'patient' && !z.revealed) {
    // "corpse"
    ctx.fillStyle = '#20202a'; ctx.beginPath(); ctx.ellipse(0, 6, 16, 7, 0.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#15151d'; ctx.beginPath(); ctx.arc(-12, 4, 6, 0, 7); ctx.fill();
    ctx.restore(); return;
  }
  const wob = Math.sin(z.phase * (z.aggro ? 9 : 3)) * 2;
  ctx.rotate(z.aggro ? Math.atan2(player.y - z.y, player.x - z.x) : 0);
  const bodyCol = z.type === 'sprinter' ? '#2b1220' : z.type === 'lurker' ? '#1a2420' : '#242028';
  const rimCol = z.type === 'sprinter' ? '#b91c1c' : z.type === 'lurker' ? '#14532d' : '#3f3f46';
  ctx.fillStyle = bodyCol;
  ctx.beginPath(); ctx.ellipse(2, wob, 13, 10, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = rimCol; ctx.stroke();
  ctx.fillStyle = rimCol; ctx.beginPath(); ctx.arc(4, wob, 5.5, 0, 7); ctx.fill();
  // arms forward when aggro
  if (z.aggro) { ctx.strokeStyle = bodyCol; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(4, -5); ctx.lineTo(20, -2); ctx.moveTo(4, 5); ctx.lineTo(20, 2); ctx.stroke(); ctx.lineWidth = 1; }
  ctx.restore();
}

function drawNPC(n) {
  ctx.save(); ctx.translate(n.x, n.y);
  const bob = Math.sin(stateTime * 2 + n.x) * 1.5;
  ctx.fillStyle = '#1d1a2b';
  ctx.beginPath(); ctx.ellipse(0, bob, 11, 9, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = n.col; ctx.stroke();
  ctx.fillStyle = n.col; ctx.beginPath(); ctx.arc(0, bob - 4, 4.5, 0, 7); ctx.fill();
  ctx.restore();
  // name tag
  ctx.fillStyle = n.col; ctx.font = '9px monospace'; ctx.textAlign = 'center';
  ctx.fillText(n.name, n.x, n.y - 18);
}

function drawMemorial(m) {
  ctx.save(); ctx.translate(m.x, m.y);
  ctx.fillStyle = 'rgba(251,191,36,0.9)';
  const fl = 2 + Math.sin(stateTime * 7) * 0.8;
  ctx.fillRect(-1.5, -8 - fl, 3, 4 + fl); // flame
  ctx.fillStyle = '#e7e5e4'; ctx.fillRect(-2, -4, 4, 6); // candle
  ctx.strokeStyle = '#57534e'; ctx.strokeRect(-8, -2, 16, 6); // base
  ctx.restore();
  ctx.fillStyle = 'rgba(196,181,253,0.75)'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
  ctx.fillText('† ' + m.name, m.x, m.y - 16);
}

/* lighting */
const lightCanvas = document.createElement('canvas');
const lctx = lightCanvas.getContext('2d');
function renderLighting() {
  lightCanvas.width = VW; lightCanvas.height = VH;
  const dark = darkness();
  lctx.globalCompositeOperation = 'source-over';
  lctx.fillStyle = `rgba(4,4,12,${dark})`;
  lctx.fillRect(0, 0, VW, VH);
  lctx.globalCompositeOperation = 'destination-out';
  // player light: wider with instinct, narrower with fear/starve
  let radius = 150 + player.instinct * 1.6 - player.fear * 0.9;
  if (player.hunger <= 0) radius *= 0.55;
  if (player.torch) radius = Math.max(radius, 260);
  radius = clamp(radius, 70, 340);
  cutLight(lctx, VW / 2, VH / 2, radius);
  for (const f of flares) {
    const sx = f.x - cam.x + VW / 2, sy = f.y - cam.y + VH / 2;
    if (sx > -200 && sx < VW + 200 && sy > -200 && sy < VH + 200)
      cutLight(lctx, sx, sy, 130 + Math.sin(stateTime * 11 + f.flick) * 12, 0.95);
  }
  for (const m of memorials) {
    const sx = m.x - cam.x + VW / 2, sy = m.y - cam.y + VH / 2;
    if (sx > -100 && sx < VW + 100 && sy > -100 && sy < VH + 100)
      cutLight(lctx, sx, sy, 46 + Math.sin(stateTime * 7) * 5, 0.8);
  }
  lctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(lightCanvas, 0, 0);
  // purple rim mood
  ctx.fillStyle = 'rgba(76,29,149,0.05)';
  ctx.fillRect(0, 0, VW, VH);
}
function cutLight(c, x, y, r, strength = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(0.55, `rgba(0,0,0,${strength * 0.6})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
}

/* ---------------- UI ---------------- */
const hpBar = document.getElementById('hp-fill');
const hgBar = document.getElementById('hunger-fill');
const inBar = document.getElementById('instinct-fill');
const hpVal = document.getElementById('hp-val');
const invEl = document.getElementById('inv');
const dayEl = document.getElementById('day');
const clockEl = document.getElementById('clock');
const vignetteEl = document.getElementById('vignette');
const whisperEl = document.getElementById('whispers');

function updateUI() {
  hpBar.style.width = clamp(player.hp, 0, 100) + '%';
  hgBar.style.width = clamp(player.hunger, 0, 100) + '%';
  inBar.style.width = clamp(player.instinct, 0, 100) + '%';
  hpBar.style.background = player.hp < 30 ? '#dc2626' : '#8b5cf6';
  hpVal.textContent = Math.ceil(clamp(player.hp, 0, 100));
  invEl.innerHTML =
    `<span class="inv-item">FOOD ×${player.food}</span>` +
    `<span class="inv-item">MEDKIT ×${player.med}</span>` +
    `<span class="inv-item">MEAT ×${player.meat}</span>` +
    `<span class="inv-item">FLARE ×${player.flareCount || 0}</span>` +
    (player.hasPart ? `<span class="inv-item part">◈ RADIO PART</span>` : '') +
    `<span class="inv-item">WPN: STEEL PIPE</span>` +
    (player.bleeding ? `<span class="inv-item bad">BLEEDING — press H</span>` : '');
  const t = dayT / DAY_LEN;
  dayEl.textContent = 'DAY ' + (3652 + flags.deaths + (t < 0.28 ? 0 : 1));
  clockEl.textContent = isNight() ? '☾ NIGHT' : t < 0.3 ? '◐ DAWN' : t > 0.75 ? '◑ DUSK' : '☀ DAY';
  clockEl.style.color = isNight() ? '#8b5cf6' : '#94a3b8';
  if (flags.extraction) clockEl.textContent = '⏳ BOATS: ' + Math.ceil(flags.extractT) + 's';
  // vignette closes with fear/starve/low hp
  const squeeze = clamp((100 - player.hp) * 0.25 + player.fear * 0.28 + (player.hunger <= 0 ? 40 : 0), 0, 62);
  vignetteEl.style.boxShadow = `inset 0 0 ${120 + squeeze * 3}px ${squeeze}px rgba(2,2,6,0.94)`;
  // low instinct whispers
  if ((player.instinct < 35 || player.hunger <= 0) && Math.random() < 0.02) showWhisper();
}
function showWhisper() {
  const words = ['eat', 'they are gone', 'sleep', 'open the door', 'it is safe', 'look behind you', 'ten years', 'eat'];
  const w = document.createElement('span');
  w.textContent = pick(words);
  w.style.left = rand(8, 78) + '%'; w.style.top = rand(15, 80) + '%';
  whisperEl.appendChild(w);
  setTimeout(() => w.remove(), 2600);
}

/* ---------------- flares & particles update ---------------- */
function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= p.drag; p.vy *= p.drag;
    p.life -= dt;
    if (p.blood && p.life <= 0 && Math.random() < 0.12) {
      bloodPools.push({ x: p.x, y: p.y, r: rand(4, 9), a: 0.5 });
      if (bloodPools.length > 260) bloodPools.shift();
    }
  }
  particles = particles.filter(p => p.life > 0);
  for (const f of flares) f.t -= dt;
  flares = flares.filter(f => f.t > 0);
}

/* ---------------- night spawns ---------------- */
function updateWorld(dt) {
  dayT += dt;
  if (dayT >= DAY_LEN) { dayT = 0; log('dawn. the birds are wrong but they sing.', ''); }
  if (isNight()) {
    nightSpawnT -= dt;
    if (nightSpawnT <= 0) {
      nightSpawnT = 9;
      if (zombies.length < 40) {
        const p = walkableSpawn(520);
        spawnZombie(Math.random() < 0.15 ? 'sprinter' : 'rotter', p);
      }
    }
  }
  // rumor cadence
  rumorTimer -= dt;
  if (rumorTimer <= 0) { rumorTimer = rand(9, 16); rumor(); }
  // zombie proximity groans
  if (Math.random() < dt * 0.25) {
    const z = zombies.find(z => dist(z.x, z.y, player.x, player.y) < 8 * TILE);
    if (z) sfx.groan();
  }
  // heartbeat under 30 hp
  if (player.hp < 30) {
    heartbeatT -= dt;
    if (heartbeatT <= 0) { heartbeatT = 1.1; sfx.heart(); }
  }
  // chotu passive rumor boost flavor
  if (flags.chotu === 'vendor' && Math.random() < dt * 0.02) log('chotu\'s counting drifts up from the flyover. it helps.');
}

/* ---------------- main loop ---------------- */
let last = performance.now(), stateTime = 0;
function loop(now) {
  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) resize();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; stateTime += dt;
  shakes = Math.max(0, shakes - dt * 30);
  if (mode === 'play') {
    updatePlayer(dt);
    updateZombies(dt);
    updateItems(dt);
    updateParticles(dt);
    updateWorld(dt);
    updateCam(dt);
    updateUI();
  } else if (mode === 'dialog') {
    updateCam(dt);
  }
  if (mode !== 'title') render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------------- start ---------------- */
function startGame() {
  if (mode !== 'title') return;
  audioInit();
  document.getElementById('overlay-title').classList.add('hidden');
  mode = 'play';
  log('the lock has not turned in 3,653 days.', 'obj');
  log('objective: survive. help. find out if they are gone.', 'obj');
  rumorTimer = 5;
  updateUI();
}
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-respawn').addEventListener('click', respawn);
document.getElementById('btn-again').addEventListener('click', () => location.reload());

})();
